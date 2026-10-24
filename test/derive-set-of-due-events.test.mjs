import assert from "node:assert/strict";
import test from "node:test";
import { deriveSetOfDueEvents } from "../scripts/derive-set-of-due-events.mjs";

test("an event never done, with a past occurrence, is due as never-done", () => {
  const result = deriveSetOfDueEvents({
    events: [{ id: "daily-standup", dtstart: "19970902T090000Z", rrule: "FREQ=DAILY;COUNT=10" }],
    now: "1997-09-05T00:00:00Z",
  });
  assert.deepEqual(result.due, [
    { id: "daily-standup", occurrence: "1997-09-04T09:00:00.000Z", reason: "never-done" },
  ]);
});

test("an event done after its most recent occurrence is not due", () => {
  const result = deriveSetOfDueEvents({
    events: [{ id: "daily-standup", dtstart: "19970902T090000Z", rrule: "FREQ=DAILY;COUNT=10" }],
    now: "1997-09-05T00:00:00Z",
    lastDone: { "daily-standup": "1997-09-04T10:00:00Z" },
  });
  assert.deepEqual(result.due, []);
});

test("an event with a new occurrence since it was last done is due as occurrence-after-last-done", () => {
  const result = deriveSetOfDueEvents({
    events: [{ id: "daily-standup", dtstart: "19970902T090000Z", rrule: "FREQ=DAILY;COUNT=10" }],
    now: "1997-09-05T10:00:00Z",
    lastDone: { "daily-standup": "1997-09-04T10:00:00Z" },
  });
  assert.deepEqual(result.due, [
    { id: "daily-standup", occurrence: "1997-09-05T09:00:00.000Z", reason: "occurrence-after-last-done" },
  ]);
});

test("an event with no occurrence yet is not due", () => {
  const result = deriveSetOfDueEvents({
    events: [{ id: "future-thing", dtstart: "19980101T090000Z", rrule: "FREQ=DAILY;COUNT=3" }],
    now: "1997-09-05T00:00:00Z",
  });
  assert.deepEqual(result.due, []);
});

test("multiple events resolve independently", () => {
  const result = deriveSetOfDueEvents({
    events: [
      { id: "daily-standup", dtstart: "19970902T090000Z", rrule: "FREQ=DAILY;COUNT=10" },
      { id: "future-thing", dtstart: "19980101T090000Z", rrule: "FREQ=DAILY;COUNT=3" },
    ],
    now: "1997-09-05T00:00:00Z",
  });
  assert.deepEqual(result.due, [
    { id: "daily-standup", occurrence: "1997-09-04T09:00:00.000Z", reason: "never-done" },
  ]);
});

test("refuses a non-array events", () => {
  assert.throws(() => deriveSetOfDueEvents({ events: "nope", now: "1997-01-01T00:00:00Z" }), TypeError);
});

test("refuses a missing now", () => {
  assert.throws(() => deriveSetOfDueEvents({ events: [] }), TypeError);
});

test("refuses an event without a string id", () => {
  assert.throws(
    () => deriveSetOfDueEvents({ events: [{ dtstart: "19970902T090000Z" }], now: "1997-01-01T00:00:00Z" }),
    TypeError,
  );
});

test("refuses an event without a string dtstart", () => {
  assert.throws(
    () => deriveSetOfDueEvents({ events: [{ id: "x" }], now: "1997-01-01T00:00:00Z" }),
    TypeError,
  );
});


test("malformed or impossible historical completion does not suppress genuinely due Work",()=>{
  const base={events:[{id:"daily-standup",dtstart:"19970902T090000Z",
    rrule:"FREQ=DAILY;COUNT=10"}],now:"1997-09-05T10:00:00Z"};
  for(const invalid of [
    "not a time","yesterday","1997-02-30T10:00:00Z",
    "1997-09-04T25:00:00Z","1997-09-04T10:61:00Z",
    "1997-09-04","1997-09-04T10:00:00+15:00",null,{},42,
  ])assert.throws(()=>deriveSetOfDueEvents({...base,
    lastDone:{"daily-standup":invalid}}),/lastDone/u);
  assert.deepEqual(deriveSetOfDueEvents(base).due,[{
    id:"daily-standup",occurrence:"1997-09-05T09:00:00.000Z",reason:"never-done",
  }]);
});

test("a future-only receipt cannot mark current Work as discharged",()=>{
  assert.throws(()=>deriveSetOfDueEvents({
    events:[{id:"x",dtstart:"19970902T090000Z",rrule:"FREQ=DAILY;COUNT=10"}],
    now:"1997-09-05T09:00:00Z",
    lastDone:{x:"1997-09-06T10:00:00Z"},
  }),/future/u);
});

test("valid explicitly zoned receipt round-trips to the same observed instant",()=>{
  const work={events:[{id:"x",dtstart:"19970902T090000Z",
    rrule:"FREQ=DAILY;COUNT=10"}],now:"1997-09-05T10:00:00Z"};
  const done=deriveSetOfDueEvents({...work,
    lastDone:{x:"1997-09-04T05:00:00-05:00"}});
  assert.deepEqual(done.due,[{id:"x",occurrence:"1997-09-05T09:00:00.000Z",
    reason:"occurrence-after-last-done"}]);
  const completed=deriveSetOfDueEvents({...work,
    lastDone:{x:"1997-09-05T04:00:00-05:00"}});
  assert.deepEqual(completed.due,[]);
});

test("repeated IDs and inherited receipt fields do not manufacture completed Work",()=>{
  const event={id:"shared",dtstart:"19970902T090000Z"};
  assert.throws(()=>deriveSetOfDueEvents({
    events:[event,event],now:"1997-09-05T09:00:00Z",
  }),/distinct source id/u);
  const inherited=Object.create({shared:"1997-09-07T09:00:00Z"});
  const reading=deriveSetOfDueEvents({
    events:[event],now:"1997-09-05T09:00:00Z",lastDone:inherited,
  });
  assert.equal(reading.due[0].reason,"never-done");
});

test("invalid observation instants and non-map receipts refuse rather than returning empty due Work",()=>{
  for(const now of ["not-a-time","1997-02-30T10:00:00Z","1997-09-05","1997-09-05T25:00:00Z"])
    assert.throws(()=>deriveSetOfDueEvents({events:[],now}),/now/u);
  for(const lastDone of [null,[],false,7,"complete"])
    assert.throws(()=>deriveSetOfDueEvents({events:[],now:"1997-09-05T09:00:00Z",lastDone}),/lastDone/u);
});
