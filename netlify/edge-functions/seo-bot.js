export default async (request, context) => {
  return new Response("SEO-BOT CALISIYOR", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
};