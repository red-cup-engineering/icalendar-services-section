import assert from "node:assert/strict";
import test from "node:test";
import { renderSourceWorkTodos } from "../scripts/render-source-work-todos.mjs";

const AT="2026-10-24T17:00:00.000Z";
const NI = digit => "ni:///sha-256;"+String(digit).padStart(43,"0");
const work=(digit,extra={})=>({
  id:NI(digit),summary:"Receive customer-requested source Work",
  description:"Original work awaits independent acceptance",
  sourceUrl:"https://github.com/red-cup-engineering/agent-organization-engine/issues/53",
  observedAt:"2026-10-24T16:00:00.000Z",...extra,
});
const exportWork=records=>renderSourceWorkTodos({at:AT,work:records});
const unfold=text=>text.replace(/\r\n /gu,"");

test("RFC 5545 VTODO retains original NI, date-exclusive due and independent unreceived status",()=>{
  const first=work(1,{
    start:{kind:"date",value:"2026-10-24"},
    due:{kind:"date-exclusive",value:"2026-10-25"},
  });
  const second=work(2,{
    summary:first.summary, // same title is not the same Work
    start:{kind:"utc",value:"2026-10-24T16:30:00.000Z"},
    due:{kind:"utc",value:"2026-10-24T17:30:00.000Z"},
  });
  const original=JSON.stringify([second,first]);
  const result=exportWork([second,first]);
  assert.equal(result.kind,"icalendar.source-work-todos.v1");
  assert.equal(result.contentType,"text/calendar; charset=utf-8");
  assert.equal(result.count,2);
  assert.equal(result.withoutDueCount,0);
  assert.deepEqual(result.sourceWorkIds,[NI(1),NI(2)]);
  assert.equal(JSON.stringify([second,first]),original,"pure projection does not mutate source");
  const text=unfold(result.text);
  assert.ok(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.equal((text.match(/BEGIN:VTODO\r\n/gu)||[]).length,2);
  assert.match(text,/DTSTART;VALUE=DATE:20261024\r\nDUE;VALUE=DATE:20261025\r\n/u);
  assert.match(text,/DTSTART:20261024T163000Z\r\nDUE:20261024T173000Z\r\n/u);
  assert.match(text,/DTSTAMP:20261024T170000Z/u);
  assert.ok(text.includes("UID:ni:///sha-256\\;"+NI(1).split(";")[1]));
  assert.equal((text.match(/STATUS:NEEDS-ACTION/gu)||[]).length,2);
  for(const forbidden of ["STATUS:COMPLETED","COMPLETED:","VALARM","ATTENDEE","RRULE:","METHOD:REQUEST"])
    assert.equal(text.includes(forbidden),false,forbidden+" must not be invented");
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
  assert.deepEqual(result.lostSemantics,[
    "original Work authority and actor permissions",
    "Work dependency and conflict graph",
    "independent acceptance and economic settlement",
  ]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.sourceWorkIds));
});

test("uncertain due or start stays absent; no UTC instant follows from soon/later",()=>{
  const v=exportWork([work(4)]);
  assert.equal(v.withoutDueCount,1);
  assert.equal(v.count,1);
  assert.equal(/(?:^|\r\n)(?:DTSTART|DUE)(?:;|:)/u.test(unfold(v.text)),false);
  assert.ok(unfold(v.text).includes("STATUS:NEEDS-ACTION\r\n"));
});

test("TEXT special characters and UTF-8 folding cannot inject iCalendar properties",()=>{
  const v=exportWork([work(3,{
    summary:"Test, escape; backslash\\ newline\n injection:STATUS:COMPLETED",
    description:"Sun 🌞 ".repeat(110),
  })]);
  const text=unfold(v.text);
  assert.ok(text.includes("Test\\, escape\\; backslash\\\\ newline\\n injection"));
  assert.equal(text.includes("\r\nSTATUS:COMPLETED\r\n"),false);
  // Every physical line is <=75 UTF-8 octets, including the continuation.
  for(const line of v.text.split("\r\n").filter(Boolean))
    assert.ok(Buffer.byteLength(line,"utf8")<=75,"oversized UTF-8 RFC 5545 line: "+line.slice(0,20));
});

test("the original due boundary is strictly later than the supplied same-type DTSTART",()=>{
  for(const candidate of [
    {start:{kind:"date",value:"2026-10-24"},due:{kind:"date-exclusive",value:"2026-10-24"}},
    {start:{kind:"utc",value:AT},due:{kind:"utc",value:AT}},
    {start:{kind:"date",value:"2026-10-25"},due:{kind:"date-exclusive",value:"2026-10-24"}},
    {start:{kind:"date",value:"2026-10-24"},due:{kind:"utc",value:AT}},
    {start:{kind:"utc",value:AT},due:{kind:"date-exclusive",value:"2026-10-25"}},
  ])assert.throws(()=>exportWork([work(5,candidate)]),/DUE must follow DTSTART/u);
});

test("floating, invalid, ambiguous or invented schedule states refuse instead of fabricating a deadline",()=>{
  for(const due of [
    {kind:"date",value:"2026-10-24"}, // might mean an inclusive day; no guessing
    {kind:"date-exclusive",value:"2026-02-30"},
    {kind:"date-exclusive",value:"2026-11-01",timeZone:"America/Chicago"},
    {kind:"utc",value:"2026-10-24T12:00:00-05:00"},
    {kind:"utc",value:"2026-10-24T12:00:00Z"},
    {kind:"utc",value:"2026-10-24T17:00:00.000Z\nSTATUS:COMPLETED"},
    "soon",42,
  ])assert.throws(()=>exportWork([work(6,{due})]),/due |VTODO|outstanding Work/u);
  assert.throws(()=>exportWork([work(6,{start:{kind:"date-exclusive",value:"2026-10-24"}})]),/start /u);
});

test("cannot export unknown authority, duplicate Work IDs or an invented source URI",()=>{
  for(const change of [
    {id:NI(1).slice(0,-1)}, {id:"issue #23"},
    {sourceUrl:"http://example.com/work"},
    {sourceUrl:"https://example.com/\r\nMETHOD:REQUEST"},
    {sourceUrl:"https://someone:password@example.com/"},
    {observedAt:"2026-10-24T19:00:00.000Z"},
    {observedAt:"2026-02-30T12:00:00.000Z"},
    {description:""}, {summary:"x".repeat(5000)},
    {status:"COMPLETED"}, {assayer:"self"}, {dependsOn:[]},
  ])assert.throws(()=>exportWork([work(7,change)]),/outstanding Work/u);
  assert.throws(()=>exportWork([work(8),work(8)]),/distinct original NI/u);
  assert.throws(()=>renderSourceWorkTodos({at:"tomorrow",work:[]}),/exact UTC/u);
  assert.throws(()=>renderSourceWorkTodos({at:AT,work:"untrusted"}),/at most 2048/u);
});

test("1,024 source-qualified Work subjects retain unique stable identity, full counts and bounded loss",()=>{
  const items=Array.from({length:1024},(_,i)=>work(i,{
    due:i%2===0?{kind:"date-exclusive",value:"2026-10-25"}:null,
  })).reverse();
  const result=exportWork(items);
  assert.equal(result.count,1024);
  assert.equal(result.withoutDueCount,512);
  assert.equal(result.sourceWorkIds.length,1024);
  assert.equal(new Set(result.sourceWorkIds).size,1024);
  assert.equal((result.text.match(/BEGIN:VTODO\r\n/gu)||[]).length,1024);
  assert.equal((result.text.match(/DUE;VALUE=DATE:/gu)||[]).length,512);
  assert.equal(result.sourceWorkIds[0],NI(0));
  assert.equal(result.sourceWorkIds[1023],NI(1023));
  assert.throws(()=>exportWork(Array.from({length:2049},(_,i)=>work(i))),/at most 2048/u);
});
