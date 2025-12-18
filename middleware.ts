export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/customers/:path*",
    "/repos/:path*",
    "/environments/:path*",
    "/applications/:path*",
    "/api/customers/:path*",
    "/api/applications/:path*",
    "/api/environments/:path*",
    "/api/github/:path*",
  ],
};
