// Demo data for static prototype
window.NETRICA_DEMO = window.NETRICA_DEMO || {};

window.NETRICA_DEMO.products = [
  {
    id: "netrica-tz",
    nameKey: "products.items.tz.name",
    descKey: "products.items.tz.desc",
    priceText: "$99",
    featuresKeys: [
      "products.items.tz.f1",
      "products.items.tz.f2",
      "products.items.tz.f3"
    ],
    useCasesKeys: [
      "products.items.tz.u1",
      "products.items.tz.u2",
      "products.items.tz.u3"
    ]
  },
  {
    id: "netrica-chat",
    nameKey: "products.items.chat.name",
    descKey: "products.items.chat.desc",
    priceText: "$29/mo",
    featuresKeys: [
      "products.items.chat.f1",
      "products.items.chat.f2",
      "products.items.chat.f3"
    ],
    useCasesKeys: [
      "products.items.chat.u1",
      "products.items.chat.u2",
      "products.items.chat.u3"
    ]
  },
  {
    id: "netrica-orders",
    nameKey: "products.items.orders.name",
    descKey: "products.items.orders.desc",
    priceText: "—",
    featuresKeys: [
      "products.items.orders.f1",
      "products.items.orders.f2",
      "products.items.orders.f3"
    ],
    useCasesKeys: [
      "products.items.orders.u1",
      "products.items.orders.u2",
      "products.items.orders.u3"
    ]
  },
  {
    id: "netrica-inshoat",
    nameKey: "products.items.inshoat.name",
    descKey: "products.items.inshoat.desc",
    priceText: "$149",
    featuresKeys: [
      "products.items.inshoat.f1",
      "products.items.inshoat.f2",
      "products.items.inshoat.f3"
    ],
    useCasesKeys: [
      "products.items.inshoat.u1",
      "products.items.inshoat.u2",
      "products.items.inshoat.u3"
    ]
  }
];

window.NETRICA_DEMO.demoUsers = [
  { email: "admin@netrica.com", password: "admin", name: "Admin", role: "admin" },
  { email: "user@demo.com", password: "demo", name: "Demo User", role: "user" }
];
