begin;
create table public.authorized_users (
 user_id uuid primary key references auth.users(id), active boolean not null default true,
 role text not null default 'admin' check(role='admin'), created_at timestamptz not null default now()
);
create table public.categories (id text primary key, name text not null unique);
create table public.locations (id text primary key, name text not null unique, kind text not null check(kind in ('sala','bodega','comedor','oficina','consumo')));
create table public.materials (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 category_id text not null references public.categories, unit text not null check(unit in ('unidad','rollo','paquete','litro','kg','metro')),
 minimum numeric(15,3) not null default 0 check(minimum>=0 and minimum::text not in ('NaN','Infinity','-Infinity')), junji boolean not null default false,
 consumable boolean not null default true, notes text not null default '',
 check(unit not in ('unidad','rollo','paquete') or minimum=trunc(minimum))
);
create unique index materials_name_unique on public.materials(lower(trim(name)));
create table public.balances (
 material_id uuid not null references public.materials, location_id text not null references public.locations,
 quantity numeric(15,3) not null default 0 check(quantity>=0), primary key(material_id,location_id)
);
create table public.movements (
 id uuid primary key default gen_random_uuid(), material_id uuid not null references public.materials,
 type text not null check(type in ('ingreso','consumo','traslado','reposicion')),
 quantity numeric(15,3) not null check(quantity>0), source_id text references public.locations,
 destination_id text references public.locations, occurred_at timestamptz not null,
 recorded_at timestamptz not null default now(), user_id uuid not null references public.authorized_users,
 notes text not null default '', compensates_id uuid references public.movements,
 check((type='ingreso' and source_id is null and destination_id is not null)
 or(type in ('consumo','reposicion') and source_id is not null and destination_id is null)
 or(type='traslado' and source_id is not null and destination_id is not null and source_id<>destination_id))
);
create table public.movement_details (
 movement_id uuid not null references public.movements, location_id text not null references public.locations,
 quantity numeric(15,3) not null check(quantity>0), primary key(movement_id,location_id)
);
create index movements_material_date on public.movements(material_id,recorded_at desc);
create index movements_source on public.movements(source_id);
create index movements_destination on public.movements(destination_id);
insert into public.categories values ('aseo','Aseo e higiene'),('didactico','Material didáctico'),('fungible','Material fungible'),('cocina','Utensilios'),('administrativo','Administrativo');
insert into public.locations values
 ('sala-1','Sala cuna menor','sala'),('sala-2','Sala cuna mayor A','sala'),('sala-3','Sala cuna mayor B','sala'),
 ('sala-4','Medio menor A','sala'),('sala-5','Medio menor B','sala'),('sala-6','Medio mayor A','sala'),('sala-7','Medio mayor B','sala'),
 ('bodega','Bodega','bodega'),('comedor','Comedor','comedor'),('oficina','Oficina','oficina'),
 ('bano-1','Baño 1','consumo'),('bano-2','Baño 2','consumo'),('bano-3','Baño 3','consumo');

create function public.is_authorized() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.authorized_users where user_id=auth.uid() and active)
$$;
revoke all on function public.is_authorized() from public,anon;
grant execute on function public.is_authorized() to authenticated;
-- La cuenta puede consultar solo su propia autorización, sin políticas recursivas.
alter table public.authorized_users enable row level security;
create policy read_own_authorization on public.authorized_users for select to authenticated using(user_id=auth.uid());
grant select on public.authorized_users to authenticated;
revoke insert,update,delete on public.authorized_users from anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['categories','locations','materials','balances','movements','movement_details'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy authorized_read on public.%I for select to authenticated using (public.is_authorized())',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('revoke insert, update, delete on public.%I from anon, authenticated',t);
 end loop;
end $$;

create function public.create_material(p_material jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if not public.is_authorized() then raise exception 'Acceso no autorizado'; end if;
 if (p_material->>'minimum')::numeric <> round((p_material->>'minimum')::numeric,3) then raise exception 'Máximo 3 decimales'; end if;
 insert into public.materials(name,category_id,unit,minimum,junji,consumable,notes)
 values(trim(p_material->>'name'),p_material->>'categoryId',p_material->>'unit',coalesce((p_material->>'minimum')::numeric,0),coalesce((p_material->>'junji')::boolean,false),coalesce((p_material->>'consumable')::boolean,true),coalesce(p_material->>'notes','')) returning id into new_id;
 return new_id;
end $$;

create function public.record_movement(p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare
 mat public.materials; mid uuid; q numeric; kind text; src text; dst text; dt timestamptz;
 available numeric; detail jsonb; total numeric:=0; seen text[]:=array[]::text[]; lid text; dq numeric; compensation uuid;
begin
 if not public.is_authorized() then raise exception 'Acceso no autorizado'; end if;
 kind:=p_input->>'type'; q:=(p_input->>'quantity')::numeric; src:=p_input->>'sourceId'; dst:=p_input->>'destinationId';dt:=(p_input->>'occurredAt')::timestamptz;
 -- Bloquea el material para serializar todas sus operaciones de stock.
 select * into mat from public.materials where id=(p_input->>'materialId')::uuid for update;
 if mat.id is null then raise exception 'Material inexistente'; end if;
 if q is null or q::text in ('NaN','Infinity','-Infinity') or q<=0 or q<>round(q,3) then raise exception 'Cantidad inválida: positiva, máximo 3 decimales'; end if;
 if mat.unit in ('unidad','rollo','paquete') and q<>trunc(q) then raise exception 'La unidad requiere enteros'; end if;
 if dt is null or not isfinite(dt) or dt>now()+interval '1 minute' then raise exception 'Fecha inválida o futura'; end if;
 if kind is null or kind not in ('ingreso','consumo','traslado','reposicion') then raise exception 'Tipo inválido'; end if;
 if kind='ingreso' then
   if src is not null or dst is null then raise exception 'Ingreso inválido'; end if;
 else
   if src is null or not exists(select 1 from public.locations l where l.id=src and l.kind<>'consumo') then raise exception 'Origen inválido'; end if;
 end if;
 if kind in ('ingreso','traslado') then
   if dst is null or not exists(select 1 from public.locations l where l.id=dst and l.kind<>'consumo') then raise exception 'Destino inválido'; end if;
   if kind='traslado' and src=dst then raise exception 'Origen igual al destino'; end if;
 elsif dst is not null then raise exception 'El consumo no tiene destino de inventario'; end if;
 compensation:=(p_input->>'compensatesId')::uuid;
 if compensation is not null then
   if not exists(select 1 from public.movements where id=compensation and material_id=mat.id) or length(trim(coalesce(p_input->>'notes','')))=0 then raise exception 'Corrección inválida: revisa material y observación'; end if;
 end if;
 if kind='reposicion' then
   if not mat.consumable or src<>'bodega' then raise exception 'Reposición requiere consumible de bodega'; end if;
   if jsonb_typeof(p_input->'deliveries') is distinct from 'array' or jsonb_array_length(p_input->'deliveries')=0 then raise exception 'Faltan entregas'; end if;
   for detail in select value from jsonb_array_elements(p_input->'deliveries') loop
     lid:=detail->>'locationId'; dq:=(detail->>'quantity')::numeric;
     if lid is null or lid=any(seen) or not exists(select 1 from public.locations l where l.id=lid and l.kind in ('sala','consumo')) then raise exception 'Destino inválido o duplicado'; end if;
     if dq is null or dq::text in ('NaN','Infinity','-Infinity') or dq<=0 or dq<>round(dq,3) or (mat.unit in ('unidad','rollo','paquete') and dq<>trunc(dq)) then raise exception 'Cantidad de entrega inválida'; end if;
     seen:=array_append(seen,lid);total:=total+dq;
   end loop;
   if total<>q then raise exception 'Total de entregas no coincide'; end if;
 elsif p_input ? 'deliveries' and p_input->'deliveries'<>'null'::jsonb and p_input->'deliveries'<>'[]'::jsonb then raise exception 'Entregas solo para reposición'; end if;
 if kind<>'ingreso' then
   select quantity into available from public.balances where material_id=mat.id and location_id=src for update;
   if coalesce(available,0)<q then raise exception 'Stock insuficiente'; end if;
   update public.balances set quantity=quantity-q where material_id=mat.id and location_id=src;
 end if;
 if kind in ('ingreso','traslado') then
   insert into public.balances(material_id,location_id,quantity) values(mat.id,dst,q)
   on conflict(material_id,location_id) do update set quantity=public.balances.quantity+excluded.quantity;
 end if;
 insert into public.movements(material_id,type,quantity,source_id,destination_id,occurred_at,user_id,notes,compensates_id)
 values(mat.id,kind,q,src,dst,dt,auth.uid(),coalesce(p_input->>'notes',''),compensation) returning id into mid;
 if kind='reposicion' then
   insert into public.movement_details(movement_id,location_id,quantity)
   select mid,value->>'locationId',(value->>'quantity')::numeric from jsonb_array_elements(p_input->'deliveries');
 end if;
 return mid;
end $$;

create function public.import_initial(p_rows jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r jsonb; mid uuid; q numeric;
begin
 if not public.is_authorized() then raise exception 'Acceso no autorizado'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Importación: entre 1 y 1000 filas'; end if;
 for r in select value from jsonb_array_elements(p_rows) order by lower(value->>'name') loop
   q:=(r->>'quantity')::numeric;
   if q is null or q::text in ('NaN','Infinity','-Infinity') or q<0 or q<>round(q,3) then raise exception 'Cantidad inicial inválida'; end if;
   if not exists(select 1 from public.locations where id=r->>'locationId' and kind<>'consumo') then raise exception 'Ubicación inicial inválida'; end if;
   if r->>'unit' in ('unidad','rollo','paquete') and q<>trunc(q) then raise exception 'Se requieren enteros'; end if;
   mid:=public.create_material(r);
   if q>0 then perform public.record_movement(jsonb_build_object('materialId',mid,'type','ingreso','quantity',q,'destinationId',r->>'locationId','occurredAt',now(),'notes','Importación de inventario inicial')); end if;
 end loop;
end $$;

create function public.inventory_snapshot() returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not public.is_authorized() then raise exception 'Acceso no autorizado'; end if;
 return jsonb_build_object(
  'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by name),'[]') from public.categories c),
  'locations',(select coalesce(jsonb_agg(to_jsonb(l) order by id),'[]') from public.locations l),
  'materials',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'categoryId',category_id,'unit',unit,'minimum',minimum,'junji',junji,'consumable',consumable,'notes',notes) order by name),'[]') from public.materials),
  'balances',(select coalesce(jsonb_agg(jsonb_build_object('materialId',material_id,'locationId',location_id,'quantity',quantity)),'[]') from public.balances),
  'movements',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'materialId',material_id,'type',type,'quantity',m.quantity,'sourceId',source_id,'destinationId',destination_id,'occurredAt',occurred_at,'recordedAt',recorded_at,'user',m.user_id,'notes',notes,'compensatesId',compensates_id,'deliveries',(select coalesce(jsonb_agg(jsonb_build_object('locationId',d.location_id,'quantity',d.quantity)),'[]') from public.movement_details d where d.movement_id=m.id)) order by recorded_at desc),'[]') from public.movements m)
 );
end $$;
-- La API solo puede escribir por las funciones autorizadas; no puede editar saldos ni borrar historial.
revoke all on function public.create_material(jsonb), public.record_movement(jsonb), public.import_initial(jsonb), public.inventory_snapshot() from public,anon;
grant execute on function public.create_material(jsonb), public.record_movement(jsonb), public.import_initial(jsonb), public.inventory_snapshot() to authenticated;
create function public.prevent_movement_mutation() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Historial inmutable: utiliza movimientos compensatorios'; end $$;
create trigger immutable_movements before update or delete on public.movements for each row execute function public.prevent_movement_mutation();
create trigger immutable_details before update or delete on public.movement_details for each row execute function public.prevent_movement_mutation();
commit;
