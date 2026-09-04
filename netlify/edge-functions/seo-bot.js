export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/urun/") && !path.startsWith("/magaza/")) {
    return await context.next();
  }

  const apiKey = Deno.env.get("FIREBASE_API_KEY");
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");

  const cleanPath = path.split("/urun/")[1]?.replace(/\/$/, "");
  const id = cleanPath?.split("-").pop();

  let result = [];

  result.push("SEO BOT CALISIYOR");
  result.push("-------------------");
  result.push("Path: " + path);
  result.push("Urun ID: " + (id || "BULUNAMADI"));
  result.push("API KEY: " + (apiKey ? "VAR" : "YOK"));
  result.push("PROJECT ID: " + (projectId ? "VAR" : "YOK"));

  if (!apiKey || !projectId) {
    return new Response(result.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  if (!id) {
    return new Response(result.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  const docPath =
    `artifacts/kibris-pazar/public/data/products/${id}`;

  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${docPath}?key=${apiKey}`;

  try {
    const res = await fetch(firestoreUrl);

    result.push("Firestore HTTP: " + res.status);

    if (!res.ok) {
      const errorText = await res.text();
      result.push("Firestore HATA:");
      result.push(errorText.substring(0, 500));

      return new Response(result.join("\n"), {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8"
        }
      });
    }

    const data = await res.json();
    const fields = data.fields || {};

    result.push("Firestore: BASARILI");
    result.push("Urun basligi: " + (fields.title?.stringValue || "YOK"));
    result.push("Fiyat: " + (
      fields.price?.integerValue ||
      fields.price?.doubleValue ||
      fields.price?.stringValue ||
      "YOK"
    ));
    result.push("Aciklama: " + (
      fields.description?.stringValue
        ? fields.description.stringValue.substring(0, 100)
        : "YOK"
    ));

    return new Response(result.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });

  } catch (error) {
    result.push("FETCH HATASI:");
    result.push(String(error));

    return new Response(result.join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }
};