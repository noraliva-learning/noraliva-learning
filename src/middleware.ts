import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getUserAppRole, getDashboardPath } from "@/lib/auth/getUserAppRole";

const V2_LOGIN = "/v2/login";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const path = request.nextUrl.pathname;
  const isV2 = path.startsWith("/v2");
  const isV2Login = path === V2_LOGIN;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isV2 && !isV2Login) {
      return NextResponse.redirect(new URL(V2_LOGIN, request.url));
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (isV2) {
    if (!user && !isV2Login) {
      return NextResponse.redirect(new URL(V2_LOGIN, request.url));
    }
    if (user && isV2Login) {
      const appRole = await getUserAppRole(supabase, user);
      return NextResponse.redirect(new URL(getDashboardPath(appRole), request.url));
    }
    if (user && path.startsWith("/v2/parent")) {
      const appRole = await getUserAppRole(supabase, user);
      if (appRole.role === "learner") {
        return NextResponse.redirect(new URL(getDashboardPath(appRole), request.url));
      }
    }
    const learnersMatch = path.match(/^\/v2\/learners\/(liv|elle)(?:\/|$)/);
    if (user && learnersMatch) {
      const appRole = await getUserAppRole(supabase, user);
      const slug = learnersMatch[1] as "liv" | "elle";
      if (appRole.role === "parent") {
        return NextResponse.redirect(new URL("/v2/parent", request.url));
      }
      if (appRole.role === "learner" && appRole.learnerSlug !== slug) {
        return NextResponse.redirect(new URL(getDashboardPath(appRole), request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/v2/:path*"],
};
