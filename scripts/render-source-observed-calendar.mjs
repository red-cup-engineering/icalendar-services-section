/**
 * RFC 5545 projection of DATE-precision external process observations.
 * This is a pure calendar codec, not a source-claim adjudicator, clock
 * authority, contract, schedule-trigger registration or legal cutoff.
 *
 * The original source-owning client chooses which evidence is safe to show.
 * A TENTATIVE, TRANSPARENT VEVENT records a cited public process window;
 * it is not a booked appointment and does not confer a right to act or bill.
 *
 * DTSTART is inclusive, DTEND exclusive (RFC 5545 section 3.6.1).
 * No imaginary UTC filing clock is derived from source calendar dates.
 */

const ISO_UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/u;
const ID=/^[a-z][a-z0-9:._-]{5,190}$/u;
const HEADER='-//561 Group//Source-Observed Public Processes//EN';

const canonicalInstant=value=>typeof value==='string' && ISO_UTC.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value;
const canonicalDate=value=>typeof value==='string' && ISO_DATE.test(value) &&
  Number.isFinite(Date.parse(value+'T00:00:00.000Z')) &&
  new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;
const safeText=value=>typeof value==='string' && value.trim()!=='' &&
  value.length<4096 && !/[\u0000-\u0009\u000b-\u001f\u007f]/u.test(value);
const sourceUrl=value=>{
  // WHATWG URL silently discards embedded CR/LF/TAB. RFC 5545 emits the
  // original string as a URL property, so reject source bytes that could
  // become extra calendar lines rather than trusting a normalized URL object.
  if(typeof value!=='string'||value.length>2048 ||
      /[\u0000-\u0020\u007f]/u.test(value)) return false;
  try{
    const url=new URL(value);
    return url.protocol==='https:' && Boolean(url.hostname) &&
      !url.username && !url.password && !url.hash;
  }catch{return false;}
};
const dayAfter=date=>new Date(Date.parse(date+'T00:00:00.000Z')+86_400_000)
  .toISOString().slice(0,10);
const basicDate=date=>date.replaceAll('-','');
const basicUtc=date=>date.replace(/[-:]/gu,'').replace(/\.\d{3}Z$/u,'Z');

/** RFC 5545 TEXT; newlines are folded as literal \n, never iCalendar fields. */
const escapeText=value=>value.replace(/\\/gu,'\\\\')
  .replace(/\r\n|\r|\n/gu,'\\n').replace(/;/gu,'\\;')
  .replace(/,/gu,'\\,');

/** UTF-8 byte-aware folding (75 octets max; continuation consumes one). */
function fold(line){
  const result=[];let current='',octets=0;
  for(const cp of line){
    const code=cp.codePointAt(0);
    const width=code<=0x7f?1:code<=0x7ff?2:code<=0xffff?3:4;
    if(octets+width>75){
      result.push(current);current=' ';octets=1;
    }
    current+=cp;octets+=width;
  }
  result.push(current);
  return result.join('\r\n');
}
const property=(name,value)=>fold(name+':'+value);

/**
 * @param {{at:string,events:Array<{
 *  id:string,summary:string,description:string,sourceUrl:string,
 *  observedAt:string,startDate:string,endDateInclusive:string
 * }>}} input Immutable source-selected original calendar data.
 *
 * at is an explicit source-owned publication timestamp for deterministic
 * DTSTAMP; observedAt is when the outside source was observed, not an
 * invented legal deadline or permission to publish.
 */
export function renderSourceObservedCalendar({at,events}={}){
  if(!canonicalInstant(at)||!Array.isArray(events)||events.length>100)
    throw new TypeError('calendar requires explicit exact UTC publication clock and bounded events');
  const ids=new Set();
  const validated=events.map(e=>{
    if(!e||typeof e!=='object'||Array.isArray(e)||
      typeof e.id!=='string'||!ID.test(e.id)||ids.has(e.id)||
      !safeText(e.summary)||!safeText(e.description)||
      !sourceUrl(e.sourceUrl)||!canonicalInstant(e.observedAt)||
      Date.parse(e.observedAt)>Date.parse(at)||
      !canonicalDate(e.startDate)||!canonicalDate(e.endDateInclusive)||
      e.endDateInclusive<e.startDate)
      throw new TypeError('event requires unique source ID, safe text, cited HTTPS source, real UTC observation and inclusive canonical DATE interval');
    ids.add(e.id);
    return e;
  }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const lines=[
    property('BEGIN','VCALENDAR'),
    property('VERSION','2.0'),
    property('PRODID',HEADER),
    property('CALSCALE','GREGORIAN'),
  ];
  for(const event of validated){
    const description='Source-observed public process (not a commission, legal filing instruction, or appointment). '+
      event.description+' Source observed: '+event.observedAt+
      '. Confirm the original issuer and exact local cutoff before acting.';
    lines.push(
      property('BEGIN','VEVENT'),
      property('UID',event.id+'@561.group'),
      property('DTSTAMP',basicUtc(at)),
      property('DTSTART;VALUE=DATE',basicDate(event.startDate)),
      property('DTEND;VALUE=DATE',basicDate(dayAfter(event.endDateInclusive))),
      property('TRANSP','TRANSPARENT'),
      property('STATUS','TENTATIVE'),
      property('SUMMARY',escapeText(event.summary)),
      property('DESCRIPTION',escapeText(description)),
      property('URL',event.sourceUrl),
      property('END','VEVENT'),
    );
  }
  lines.push(property('END','VCALENDAR'));
  const body=lines.join('\r\n')+'\r\n';
  return Object.freeze({
    kind:'icalendar.source-observed-calendar.v1',
    contentType:'text/calendar; charset=utf-8',
    count:validated.length,
    sourceIds:Object.freeze(validated.map(e=>e.id)),
    text:body,
  });
}

// The same original RFC 5545 serializer owns TEXT escaping, octet-aware folding,
// temporal admission and source URL safety for VEVENT and VTODO consumers.
// Exposing pure helpers changes no established public event rendering.
export { canonicalInstant, canonicalDate, safeText, sourceUrl, basicDate, basicUtc, escapeText, property };
