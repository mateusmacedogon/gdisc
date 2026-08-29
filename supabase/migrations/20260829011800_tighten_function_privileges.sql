begin;

-- Supabase projects may grant new public routines to API roles through
-- ALTER DEFAULT PRIVILEGES. These two mutating RPCs must never be callable by
-- an unauthenticated request, even though they also validate auth.uid().
revoke execute on function public.join_server_by_invite(text) from anon;
revoke execute on function public.leave_server(uuid) from anon;

commit;
