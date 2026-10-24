/**
 * Pure RFC 5545 VTODO projection of source-qualified, outstanding original Work.
 * The caller must independently authorize and select each original Work source.
 * This reader neither obtains access nor makes a calendar subscription, Work
 * move, job assignment, accepted receipt, appointment or financial claim.
 *
 * A date-only DUE is an EXCLUSIVE boundary. Callers with an inclusive "due
 * by end of local date" must first resolve that date and jurisdiction in
 * their own source. We intentionally do not invent the following day or a
 * UTC clock from a planning horizon.
 */
import {
  canonicalInstant, canonicalDate, safeText, sourceUrl, basicDate, basicUtc,
  escapeText, property,
} from "./render-source-observed-calendar.mjs";

const WORK_ID=/^ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}$/u;
const FIELDS=new Set(["id","summary","description","sourceUrl","observedAt","start","due"]);
const MAX=2048;
const product="-//561 Group//Source-Qualified Work VTODO//EN";
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);

/** Admit an exact RFC 5545 DATE or UTC instant. No floating time, TZID guess,
 * locale parsing, imaginary all-day inclusive cutoff, or silent conversion. */
function temporal(value,role) {
  if(value===undefined||value===null) return null;
  if(!value||typeof value!=="object"||Array.isArray(value)||
     Object.keys(value).sort().join(",")!=="kind,value")
    throw new TypeError(role+" must be one exact typed temporal source");
  if(value.kind==="utc") {
    if(!canonicalInstant(value.value))
      throw new TypeError(role+" UTC instant must be exact, valid YYYY-MM-DDTHH:mm:ss.sssZ");
    return {kind:"utc",value:value.value,wire:basicUtc(value.value)};
  }
  if(value.kind===(role==="due"?"date-exclusive":"date")) {
    if(!canonicalDate(value.value))
      throw new TypeError(role+" DATE boundary must be a real YYYY-MM-DD");
    return {kind:"date",value:value.value,wire:basicDate(value.value)};
  }
  throw new TypeError(role+" cannot infer an inclusive date, local zone or different time type");
}

function checkedWork(item, at, seen) {
  if(!item||typeof item!=="object"||Array.isArray(item)||
     Object.keys(item).some(key=>!FIELDS.has(key)) ||
     !WORK_ID.test(item.id??"")||seen.has(item.id) ||
     !safeText(item.summary)||!safeText(item.description)||
     !sourceUrl(item.sourceUrl)||!canonicalInstant(item.observedAt)||
     item.observedAt>at)
    throw new TypeError("outstanding Work requires one distinct original NI identity, safe text, HTTPS source, and observed timestamp");
  const start=temporal(own(item,"start")?item.start:null,"start");
  const due=temporal(own(item,"due")?item.due:null,"due");
  if(start&&due&&(start.kind!==due.kind||start.value>=due.value))
    throw new TypeError("VTODO DUE must follow DTSTART with matching DATE or UTC value type");
  seen.add(item.id);
  return {item,start,due};
}

/** RFC 5545 VTODO values are a projection, not an authority or a vendor sync.
 * Input: {at: canonical UTC publication instant, work: original selected
 * [{id: globally distinct original NI,summary,description,sourceUrl,
 *   observedAt, start?:{kind:'date'|'utc',value},
 *   due?:{kind:'date-exclusive'|'utc',value}}]}.
 * "date-exclusive" is the VTODO boundary, NOT the inclusive last workday.
 * Records here are outstanding; COMPLETED cannot be inferred from Work JSON.
 */
export function renderSourceWorkTodos({at,work}={}) {
  if(!canonicalInstant(at)||!Array.isArray(work)||work.length>MAX)
    throw new TypeError("source Work calendar requires exact UTC publication clock and at most 2048 records");
  const seen=new Set();
  const entries=work.map(item=>checkedWork(item,at,seen))
    .sort((a,b)=>a.item.id<b.item.id?-1:a.item.id>b.item.id?1:0);
  const lines=[
    property("BEGIN","VCALENDAR"),
    property("VERSION","2.0"),
    property("PRODID",product),
    property("CALSCALE","GREGORIAN"),
  ];
  for(const {item,start,due} of entries) {
    // NI Work subject is already globally content-addressed: don't create
    // another identity based on the title, GitHub issue number or row order.
    lines.push(property("BEGIN","VTODO"),
      property("UID",escapeText(item.id)),
      property("DTSTAMP",basicUtc(at)),
      property("CLASS","PRIVATE"),
      property("STATUS","NEEDS-ACTION"),
      property("SUMMARY",escapeText(item.summary)),
      property("DESCRIPTION",escapeText(
        "Source-qualified advisory Work; not an appointment, assigned legal duty, "+
        "independently accepted result, or proof of completed work. "+
        item.description+" Observed at: "+item.observedAt+
        ". Confirm the original source, authority and recipient before acting.")));
    if(start) lines.push(property(start.kind==="date"?"DTSTART;VALUE=DATE":"DTSTART",start.wire));
    if(due) lines.push(property(due.kind==="date"?"DUE;VALUE=DATE":"DUE",due.wire));
    lines.push(property("URL",item.sourceUrl),property("END","VTODO"));
  }
  lines.push(property("END","VCALENDAR"));
  return Object.freeze({
    kind:"icalendar.source-work-todos.v1",
    contentType:"text/calendar; charset=utf-8",
    count:entries.length,
    withoutDueCount:entries.filter(({due})=>due===null).length,
    sourceWorkIds:Object.freeze(entries.map(({item})=>item.id)),
    // RFC 5545 has no native relation for authority, WIT/ACK, Office,
    // budget, Work conflict, procurement terms or accepted settlement.
    lostSemantics:Object.freeze([
      "original Work authority and actor permissions",
      "Work dependency and conflict graph",
      "independent acceptance and economic settlement",
    ]),
    text:lines.join("\r\n")+"\r\n",
  });
}

export const operation=Object.freeze({
  name:"render-source-work-todos",
  description:"Render already-authorized, outstanding original Work as read-only RFC 5545 VTODO, retaining NI identities and explicit DATE-exclusive/UTC due boundaries without false completion or live schedule effects.",
  operation:renderSourceWorkTodos,
});
