// Shared by the server layout and the browser code.
// It lives in its own file on purpose: a server component can't read a plain
// value exported from a "use client" file.
export const SIDEBAR_COOKIE = "sidebar";
export const SIDEBAR_ID = "app-sidebar";
