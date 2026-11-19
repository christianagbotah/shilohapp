# Back Office navigation and layout

Use /backoffice for the canonical administrator workspace. The storefront footer
links directly to it; unauthenticated visitors see the existing secure login.

The workspace uses a desktop sticky sidebar with its own vertical scrollbar,
a mobile drawer with backdrop and Escape-key dismissal, a compact sticky
topbar, and a content area with independent page navigation. The first page
is an Overview with summary cards, actions requiring attention, recent orders
and a factual checkout readiness indicator. Business sections remain separate:

- Overview
- Orders
- Reports & insights
- Products
- Site content (with an in-page section index)
- Notifications
- Settings (with an in-page section index)

The active section is mirrored in the section URL query parameter. Browser
Back/Forward and direct links are supported. The root /backoffice is Overview.
Only public labels are in URL parameters; credentials and private order details
are not. The route is marked noindex.

Existing business API endpoints and payment state are unchanged. Payment
availability still comes from the server and can remain disabled. Navigation
must not reset live order state or affect database contents. Existing invoice
and manifest print views remain supported.

Release checks: typecheck, lint, production build, unauthenticated Back Office
login page, navigation rendering, /api/admin/orders unauthorized protection,
public catalog, and disabled Hubtel payment initiation.
