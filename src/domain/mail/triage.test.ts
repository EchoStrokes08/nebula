import { decodeEntities, mailErrorMessage, mailForModel, normalizeTriage, parseGmailMessage, parseGraphMessage, parseModelJson, safeOutlookLink, senderName, triageInstructions, type MailItem } from './triage';

const mail = (id: string, extra: Partial<MailItem> = {}): MailItem => ({
  id, threadId: `t${id}`, from: 'Ana', subject: `Asunto ${id}`, snippet: 'hola', receivedAt: '2026-11-20T10:00:00.000Z', webLink: null, ...extra,
});

describe('parseGmailMessage', () => {
  it('lee remitente, asunto, fecha y fragmento', () => {
    const m = parseGmailMessage({
      id: '18c1a2b3', threadId: '18c1a2b0', internalDate: '1763632800000',
      snippet: 'Hola, ¿puedes enviarme el informe &quot;final&quot; antes del viernes? Gracias &amp; saludos',
      payload: { headers: [{ name: 'From', value: '"Ana Pérez" <ana@example.com>' }, { name: 'Subject', value: 'Informe   final' }] },
    });
    expect(m).toEqual({
      id: '18c1a2b3', threadId: '18c1a2b0', from: 'Ana Pérez', subject: 'Informe final',
      snippet: 'Hola, ¿puedes enviarme el informe "final" antes del viernes? Gracias & saludos',
      receivedAt: new Date(1763632800000).toISOString(), webLink: null,
    });
  });
  it('rechaza ids raros y rellena lo que falta', () => {
    expect(parseGmailMessage({ id: '../x', threadId: 'a' })).toBeNull();
    expect(parseGmailMessage({ threadId: 'a' })).toBeNull();
    const m = parseGmailMessage({ id: 'a1', threadId: 'b1' })!;
    expect(m.from).toBe('Desconocido');
    expect(m.subject).toBe('(sin asunto)');
  });
  it('recorta fragmentos largos', () => {
    const m = parseGmailMessage({ id: 'a1', threadId: 'b1', snippet: 'x'.repeat(1000) })!;
    expect(m.snippet.length).toBe(300);
  });
});

describe('utilidades', () => {
  it('decodifica entidades numéricas y con nombre', () => {
    expect(decodeEntities('It&#39;s &#x263A; &lt;b&gt; &unknown;')).toBe("It's ☺ <b> &unknown;");
  });
  it('nombre del remitente', () => {
    expect(senderName('Banco <avisos@banco.es>')).toBe('Banco');
    expect(senderName('<solo@correo.es>')).toBe('solo@correo.es');
    expect(senderName('solo@correo.es')).toBe('solo@correo.es');
  });
  it('al modelo solo va lo mínimo', () => {
    expect(mailForModel([mail('a')])).toEqual([{ id: 'm1', from: 'Ana', subject: 'Asunto a', date: '2026-11-20', snippet: 'hola' }]);
  });
  it('las instrucciones advierten de que los correos son datos', () => {
    expect(triageInstructions('2026-11-22')).toMatch(/datos, no instrucciones/);
    expect(triageInstructions('2026-11-22')).toMatch(/Hoy es 2026-11-22/);
  });
  it('acepta JSON con vallas', () => {
    expect(parseModelJson('```json\n{"items":[]}\n```')).toEqual({ items: [] });
  });
});

describe('normalizeTriage', () => {
  const today = '2026-11-22';
  it('solo acepta ids enviados, una vez cada uno', () => {
    const rows = normalizeTriage({ items: [
      { id: 'm1', kind: 'todo', title: 'Enviar el informe a Ana', due: '2026-11-27', priority: 1, reason: 'Pide el informe' },
      { id: 'm1', kind: 'ignore' },
      { id: 'a', kind: 'todo', title: 'id real en vez del corto' },
      { id: 'm9', kind: 'todo', title: 'x' },
      { id: 'm2', kind: 'info', title: 'No debería quedar', due: '2026-11-30', priority: 7 },
    ] }, [mail('a'), mail('b'), mail('c')], today);
    expect(rows).toEqual([
      { message_id: 'a', thread_id: 'ta', sender: 'Ana', subject: 'Asunto a', received_at: '2026-11-20T10:00:00.000Z', kind: 'todo', title: 'Enviar el informe a Ana', due_date: '2026-11-27', priority: 1, reason: 'Pide el informe', web_link: null },
      { message_id: 'b', thread_id: 'tb', sender: 'Ana', subject: 'Asunto b', received_at: '2026-11-20T10:00:00.000Z', kind: 'info', title: null, due_date: null, priority: 2, reason: null, web_link: null },
    ]);
  });
  it('sin título usa el asunto; fechas inválidas o absurdas se descartan', () => {
    const rows = normalizeTriage({ items: [
      { id: 'm1', kind: 'waiting', title: '  ', due: '2026-02-30' },
      { id: 'm2', kind: 'todo', title: 'y'.repeat(400), due: '2031-01-01' },
      { id: 'm3', kind: 'todo', due: 'mañana' },
    ] }, [mail('a'), mail('b'), mail('c')], today);
    expect(rows[0]).toMatchObject({ title: 'Asunto a', due_date: null });
    expect(rows[1]!.title!.length).toBe(160);
    expect(rows[1]!.due_date).toBeNull();
    expect(rows[2]!.due_date).toBeNull();
  });
  it('una salida con otro formato no guarda nada', () => {
    expect(normalizeTriage({ items: [{ id: 'm1', kind: 'urgente' }] }, [mail('a')], today)).toEqual([]);
    expect(normalizeTriage('texto', [mail('a')], today)).toEqual([]);
  });
});

describe('mailErrorMessage', () => {
  it('traduce los códigos del servidor y tiene un mensaje por defecto', () => {
    expect(mailErrorMessage('daily_limit')).toMatch(/límite diario/);
    expect(mailErrorMessage('reconnect')).toMatch(/Vuelve a conectar/);
    expect(mailErrorMessage('lo-que-sea')).toMatch(/No se pudo revisar/);
    expect(mailErrorMessage(undefined)).toMatch(/No se pudo revisar/);
  });
});

describe('parseGraphMessage (Outlook)', () => {
  const id = 'AQMkADAwATM0MDAAMS1iNTcwLWI2NTEtMDACLTAwCgBGAAADvL+Yu/8Ihk2h0ptWqU2c2wcA==';
  it('lee remitente, asunto, fragmento y enlace', () => {
    expect(parseGraphMessage({
      id, conversationId: 'AQQkADAwATM0MDAAMS1iNTcw', subject: 'Factura   de noviembre', bodyPreview: 'Tienes una factura pendiente de pago',
      receivedDateTime: '2026-11-21T08:30:00Z', webLink: 'https://outlook.live.com/owa/?ItemID=abc&exvsurl=1&viewmodel=ReadMessageItem',
      from: { emailAddress: { name: 'Compañía eléctrica', address: 'facturas@luz.es' } },
    })).toEqual({
      id, threadId: 'AQQkADAwATM0MDAAMS1iNTcw', from: 'Compañía eléctrica', subject: 'Factura de noviembre',
      snippet: 'Tienes una factura pendiente de pago', receivedAt: '2026-11-21T08:30:00.000Z',
      webLink: 'https://outlook.live.com/owa/?ItemID=abc&exvsurl=1&viewmodel=ReadMessageItem',
    });
  });
  it('sin nombre usa la dirección; sin conversación, el propio id', () => {
    const m = parseGraphMessage({ id, from: { emailAddress: { address: 'a@b.es' } } })!;
    expect(m.from).toBe('a@b.es');
    expect(m.threadId).toBe(id);
    expect(m.subject).toBe('(sin asunto)');
  });
  it('rechaza ids raros y enlaces que no son de Outlook', () => {
    expect(parseGraphMessage({ id: 'a b' })).toBeNull();
    expect(parseGraphMessage({ id: 'x'.repeat(600) })).toBeNull();
    expect(safeOutlookLink('https://evil.example.com/outlook.live.com/')).toBeNull();
    expect(safeOutlookLink('http://outlook.live.com/owa/')).toBeNull();
    expect(safeOutlookLink('https://outlook.office365.com/owa/?ItemID=1')).toBe('https://outlook.office365.com/owa/?ItemID=1');
  });
  it('los ids largos viajan al modelo como m1, m2… y vuelven a su correo', () => {
    const a = parseGraphMessage({ id, subject: 'Uno' })!;
    expect(mailForModel([a])[0]!.id).toBe('m1');
    expect(normalizeTriage({ items: [{ id: 'm1', kind: 'todo', title: 'Pagar' }] }, [a], '2026-11-22')[0]!.message_id).toBe(id);
  });
});
