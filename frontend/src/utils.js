export function cleanSummary(summary) {
  if (!summary) return "No summary available.";

  const doc = new DOMParser().parseFromString(summary, "text/html");
  let text = doc.body.textContent || "";

  text = text.replace(/\s+/g, " ").trim();

  if (!text) return "No summary available.";

  if (text.length > 200) {
    text = text.slice(0, 200).replace(/\s+\S*$/, "") + "...";
  }

  return text;
}
