import { redirect } from "next/navigation";

export default function ApiDocs() {
  // Redirect to the OpenAPI spec JSON since we don't have a Swagger UI
  redirect("/openapi.json");
}
