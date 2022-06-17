import { EPOCH } from "../../constants";

export async function epochRoute() {
  return new Response(EPOCH, {
    // 31536000 is one year in seconds
    "Cache-Control": "max-age=31536000, s-maxage=31536000",
  });
}
