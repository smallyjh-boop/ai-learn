import { StyleSheet, useColorScheme } from "react-native";

const light = { bg: "#fbfaf7", card: "#ffffff", ink: "#1d1f23", muted: "#646a73", line: "#e6e3dc", accent: "#0f7b6c", accentSoft: "#e3f2ef", warn: "#b25e09" };
const dark = { bg: "#15171a", card: "#1e2125", ink: "#ecebe7", muted: "#9aa0a8", line: "#2e3237", accent: "#4cc2ae", accentSoft: "#1d3330", warn: "#f0a050" };
export type Colors = typeof light;

export function useTheme() {
  const c = useColorScheme() === "dark" ? dark : light;
  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 48 },
    card: { backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
    h1: { fontSize: 22, fontWeight: "700", color: c.ink, marginBottom: 12 },
    h2: { fontSize: 17, fontWeight: "700", color: c.ink },
    text: { fontSize: 16, lineHeight: 24, color: c.ink },
    muted: { fontSize: 14, color: c.muted },
    btn: { backgroundColor: c.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: "center" },
    btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
    ghost: { borderColor: c.line, borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: "center" },
    input: { borderColor: c.line, borderWidth: 1, borderRadius: 10, padding: 12, color: c.ink, backgroundColor: c.card, fontSize: 16 },
    box: { backgroundColor: c.bg, borderColor: c.line, borderWidth: 1, borderRadius: 10, padding: 12, marginVertical: 6 },
  });
  return { c, s };
}
