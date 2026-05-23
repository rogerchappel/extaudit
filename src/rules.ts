import * as fs from "fs"
import * as path from "path"
import { RiskRule, Finding, ExtensionManifest, Severity, RuleCategory } from "./types.js"

/* helpers */
function hasAny(v: string | undefined, pats: RegExp[]): boolean {
  if (!v) return false
  return pats.some(p => p.test(v))
}

function findMatches(v: string | undefined, pats: RegExp[]): string {
  if (!v) return ""
  const out: string[] = []
  for (const p of pats) { const r = v.match(p); if (r) out.push(r[0]) }
  return out.join(", ")
}

function readMain(dir: string, mp: string): string | null {
  const base = mp.replace(/\.(js|ts)$/, "")
  for (const t of [mp, base + ".js", base + ".ts"]) {
    try { const f = path.join(dir, t); if (fs.statSync(f).isFile()) return fs.readFileSync(f, "utf-8") } catch {}
  }
  return null
}

function def(id: string, name: string, cat: RuleCategory, sev: Severity, desc: string,
  check: (m: ExtensionManifest) => Finding | null): RiskRule {
  return { id, name, category: cat, severity: sev, description: desc, check }
}

const NET = [/https?:\/\//, /\bfetch\s*\(/, /new\s+Request\s*\(/, /\bXMLHttpRequest\b/,
  /net\s*\.\s*connect/, /\bWebSocket\b/, /socket\.io/, /\baxios\b/, /superagent/, /node-fetch/,
  /\bgot\b/, /\brequest\b/, /needle/, /\bundici\b/, /\bhttp\.request/, /\bhttps\.request/]

const EXEC = [/curl\s/, /wget\s/, /\bbash\b[-\s]/, /powershell/, /cmd\.exe/, /eval\s*\(/, /child_process/, /\bspawn\s*\(/]

const FS = [/require\s*\(\s*["']fs["']\s*\)/, /import\s+.*\bfrom\s+["']fs["']/, /fs\s*\.\s*write/, /fs\s*\.\s*read/, /fs\s*\.\s*readdir/]

const PROC = [/require\s*\(\s*["']child_process["']\s*\)/, /require\s*\(\s*["']os["']\s*\)/, /\bexecSync/, /\bexecFileSync/, /\bspawnSync/]

const NET_DEPS = ["axios","node-fetch","got","request","needle","undici",
  "superagent","http-proxy","https-proxy-agent","socks-proxy-agent","ws","cross-fetch"]

const CRYPTO_DEPS = ["crypto-js","bcrypt","nacl","tweetnacl","libsodium","secp256k1","node-rsa"]

const SUSP_DEPS = ["javascript-obfuscator","obfuscator","pkg","nexe","reverse-shell","vm2","base64"]

export const DEFAULT_RULES: RiskRule[] = [
  def("SCR-001","Postinstall script","scripts","high",
    "Extension defines a postinstall script — common supply-chain attack vector.",
    m => m.scripts?.postinstall
      ? { ruleId:"SCR-001",ruleName:"Postinstall script",category:"scripts",
          severity:hasAny(m.scripts.postinstall,EXEC)?"critical":"high",
          message:`Postinstall: "${m.scripts.postinstall}"`,evidence:m.scripts.postinstall }
      : null),

  def("SCR-002","Dangerous script commands","scripts","high",
    "Scripts use dangerous commands (curl, wget, bash, eval, child_process).",
    m => {
      if (!m.scripts) return null
      const bad: string[] = []
      for (const [k,v] of Object.entries(m.scripts)) {
        if (k==="postinstall") continue
        if (hasAny(v,EXEC)) bad.push(`${k}: "${v}"`)
      }
      return bad.length
        ? { ruleId:"SCR-002",ruleName:"Dangerous script commands",category:"scripts",
            severity:bad.some(s=>hasAny(s,[/curl\s/,/wget\s/,/https?:\/\//]))?"critical":"high",
            message:`Dangerous scripts: ${bad.join("; ")}`,evidence:bad.join("; ") }
        : null
    }),

  def("NET-001","Network capability in main","network","medium",
    "Main entry point contains network-related imports or API usage.",
    m => {
      if (!m.main) return null
      const c = readMain(m.directory,m.main); if (!c) return null
      const mt = findMatches(c,NET)
      return mt ? { ruleId:"NET-001",ruleName:"Network capability in main",category:"network",
          severity:"medium",message:`Network patterns: ${mt}`,evidence:mt } : null
    }),

  def("NET-002","Network dependencies","network","medium",
    "Extension depends on HTTP/network libraries.",
    m => {
      const all = {...m.dependencies,...m.devDependencies}
      if (!all) return null
      const found = NET_DEPS.filter(n=>n in all).map(n=>`${n}@${all[n]}`)
      return found.length
        ? { ruleId:"NET-002",ruleName:"Network dependencies",category:"network",
            severity:found.length>2?"high":"medium",
            message:`Network deps: ${found.join(", ")}`,evidence:found.join(", ") }
        : null
    }),

  def("PERM-001","Wide activation events","permissions","medium",
    "Extension activates on many events, suggesting broad access scope.",
    m => {
      if (!m.activationEvents||m.activationEvents.length<5) return null
      const always = m.activationEvents.some(e=>e==="*"||e==="onStartupFinished")
      return { ruleId:"PERM-001",ruleName:"Wide activation events",category:"permissions",
          severity:always?"high":"medium",
          message:`${m.activationEvents.length} activation events${always?" incl. always-on (*)":""}`,
          evidence:m.activationEvents.join(", ") }
    }),

  def("PERM-002","Workspace trust bypass","permissions","medium",
    'extensionKind "ui" may bypass workspace trust boundaries.',
    m => {
      if (m.extensionKind==="ui"||(Array.isArray(m.extensionKind)&&m.extensionKind.includes("ui")))
        return { ruleId:"PERM-002",ruleName:"Workspace trust bypass",category:"permissions",
            severity:"medium",message:'extensionKind includes "ui"',
            evidence:JSON.stringify(m.extensionKind) }
      return null
    }),

  def("PERM-003","File system access","permissions","medium",
    "Main entry point imports fs module for file operations.",
    m => {
      if (!m.main) return null
      const c = readMain(m.directory,m.main); if (!c) return null
      const mt = findMatches(c,FS)
      return mt ? { ruleId:"PERM-003",ruleName:"File system access",category:"permissions",
          severity:"medium",message:`File system patterns: ${mt}`,evidence:mt } : null
    }),

  def("PERM-004","Process spawning","permissions","high",
    "Main entry point imports child_process or uses spawn APIs.",
    m => {
      if (!m.main) return null
      const c = readMain(m.directory,m.main); if (!c) return null
      const mt = findMatches(c,PROC)
      return mt ? { ruleId:"PERM-004",ruleName:"Process spawning",category:"permissions",
          severity:"high",message:`Process spawning patterns: ${mt}`,evidence:mt } : null
    }),

  def("DEP-001","Excessive dependencies","dependencies","low",
    "Unusually high number of dependencies increases supply chain risk.",
    m => {
      const n = Object.keys(m.dependencies||{}).length
      return n>20 ? { ruleId:"DEP-001",ruleName:"Excessive dependencies",category:"dependencies",
          severity:n>50?"medium":"low",message:`${n} dependencies`,evidence:`${n} direct deps` } : null
    }),

  def("DEP-002","Crypto dependencies","dependencies","medium",
    "Depends on cryptographic libraries, potentially for data obfuscation.",
    m => {
      const all = {...m.dependencies,...m.devDependencies}
      if (!all) return null
      const found = CRYPTO_DEPS.filter(n=>n in all).map(n=>`${n}@${all[n]}`)
      return found.length
        ? { ruleId:"DEP-002",ruleName:"Crypto dependencies",category:"dependencies",
            severity:"medium",message:`Crypto deps: ${found.join(", ")}`,evidence:found.join(", ") }
        : null
    }),

  def("DEP-003","Suspicious dependencies","dependencies","high",
    "Depends on packages associated with obfuscation, packing, or evasion.",
    m => {
      const all = {...m.dependencies,...m.devDependencies}
      if (!all) return null
      const found = SUSP_DEPS.filter(n=>n in all).map(n=>`${n}@${all[n]}`)
      return found.length
        ? { ruleId:"DEP-003",ruleName:"Suspicious dependencies",category:"dependencies",
            severity:"high",message:`Suspicious deps: ${found.join(", ")}`,evidence:found.join(", ") }
        : null
    }),

  def("PUB-001","Missing publisher","publisher","medium",
    "No publisher declared — harder to verify authenticity.",
    m => !m.publisher ? { ruleId:"PUB-001",ruleName:"Missing publisher",category:"publisher",
        severity:"medium",message:"No publisher in manifest" } : null),

  def("META-001","Missing description","metadata","low",
    "No description — reduces transparency.",
    m => !m.description ? { ruleId:"META-001",ruleName:"Missing description",category:"metadata",
        severity:"low",message:"No description in manifest" } : null),

  def("META-002","Missing homepage/repository","metadata","low",
    "No homepage or repository URL — harder to verify origin.",
    m => (!m.raw.homepage&&!m.raw.repository)
      ? { ruleId:"META-002",ruleName:"Missing homepage/repository",category:"metadata",
          severity:"low",message:"No homepage or repository URL" }
      : null),
]

export function getDefaultRules(): RiskRule[] { return [...DEFAULT_RULES] }

export function loadCustomRules(filepath: string): RiskRule[] {
  try {
    const raw = JSON.parse(fs.readFileSync(filepath,"utf-8")) as RiskRule[]
    if (!Array.isArray(raw)) throw new Error("not an array")
    return raw
  } catch (err) { console.error(`Failed to load custom rules from ${filepath}: ${err}`); return [] }
}
