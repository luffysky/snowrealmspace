-- 0052_match_memories.sql
-- 語意檢索：對 memories.embedding 做 pgvector 餘弦距離排序。
--
-- security invoker（預設）→ 沿用 memories 的 RLS（owner 才讀得到自己 space 的記憶），
-- 不繞過授權。p_query_embedding 收 text，在函式內 cast 成 vector(768) ——
-- 這樣 PostgREST 傳參最穩（不同版本對 array→vector 的自動轉型行為不一致，
-- 用 '[..]' 字面量沒有歧義）。
--
-- 冪等：create or replace + grant 可重複套用。

create or replace function public.match_memories(
  p_space_id uuid,
  p_query_embedding text,
  p_match_count int default 8
)
returns table (id uuid, content text, sensitivity text, similarity double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.content,
    m.sensitivity,
    1 - (m.embedding <=> p_query_embedding::vector(768)) as similarity
  from public.memories m
  where m.space_id = p_space_id
    and m.approved = true
    and m.sensitivity <> 'restricted'
    and m.deleted_at is null
    and m.embedding is not null
  order by m.embedding <=> p_query_embedding::vector(768)
  limit greatest(1, least(coalesce(p_match_count, 8), 50))
$$;

grant execute on function public.match_memories(uuid, text, int) to authenticated, service_role;
