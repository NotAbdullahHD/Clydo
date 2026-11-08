/* /embeds */

const form = document.querySelector('#builder');
const preview = document.querySelector('#preview');
const output = document.querySelector('#json');
const thumb = document.querySelector('#thumb');
const image = document.querySelector('#thumb-img');
const hint = document.querySelector('#hint');

const limits = { author: 256, title: 256, desc: 4096, footer: 2048, field: 256, value: 1024 };

/* which shape the copy button hands over: discord's classic embed, or a
   components v2 container. /embed takes either — the container is the one that
   keeps the accent rail and the section thumbnail. */
let mode = 'embed';

const read = (id) => document.querySelector(`#${id}`)?.value ?? '';

const fields = () => [...document.querySelectorAll('.field-block')].map((block) => ({
  name: block.querySelector('.field-name').value.trim(),
  value: block.querySelector('.field-value').value.trim(),
  inline: block.querySelector('.field-inline').checked,
})).filter((field) => field.name || field.value);

const colour = () => {
  const raw = read('color').trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw;
  return /^[0-9a-f]{6}$/i.test(full) ? `#${full.toLowerCase()}` : '#2b2d31';
};

const data = () => {
  const payload = {};

  if (read('author').trim()) payload.author = { name: read('author').trim() };
  if (read('title').trim()) payload.title = read('title').trim();
  if (read('desc').trim()) payload.description = read('desc').trim();
  payload.color = parseInt(colour().slice(1), 16);

  const list = fields();
  if (list.length) payload.fields = list;
  if (read('thumb').trim()) payload.thumbnail = { url: read('thumb').trim() };
  if (read('footer').trim()) payload.footer = { text: read('footer').trim(), icon_url: 'assets/pfp.png' };

  return payload;
};

/* the same content as one container: heading, rule, body, fields, footer.
   type 17 is the container, 10 a text block, 14 a divider, 9 a section, 11 its
   thumbnail — and 32768 is the flag that says this message is components v2. */
const container = () => {
  const payload = data();
  const blocks = [];
  const heading = [
    payload.title ? `## ${payload.title}` : '',
    payload.author ? `-# ${payload.author.name}` : '',
  ].filter(Boolean).join('\n');

  if (heading) {
    if (payload.thumbnail) {
      blocks.push({
        type: 9,
        components: [{ type: 10, content: heading }],
        accessory: { type: 11, media: { url: payload.thumbnail.url } },
      });
    } else {
      blocks.push({ type: 10, content: heading });
    }
  }

  if (payload.description) {
    if (blocks.length) blocks.push({ type: 14, divider: true, spacing: 1 });
    blocks.push({ type: 10, content: payload.description });
  }

  if (payload.fields?.length) {
    blocks.push({
      type: 10,
      content: payload.fields
        .map((field) => `**${field.name || 'field'}**\n${field.value}`)
        .join('\n\n'),
    });
  }

  if (payload.footer) blocks.push({ type: 10, content: `-# ${payload.footer.text}` });

  return {
    flags: 32768,
    components: [{ type: 17, accent_color: payload.color, components: blocks }],
  };
};

const escape = (value) => String(value).replace(/[&<>"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
}[character]));

const embedHtml = (payload) => {
  const list = payload.fields ?? [];
  const inline = list.length > 0 && list.every((field) => field.inline);

  return [
    payload.author ? `<div class="emb-author"><img src="assets/pfp.png" alt="">${escape(payload.author.name)}</div>` : '',
    payload.thumbnail ? `<img class="emb-thumb" src="${escape(payload.thumbnail.url)}" alt="">` : '',
    payload.title ? `<div class="emb-title">${escape(payload.title)}</div>` : '',
    payload.description ? `<p class="emb-desc">${escape(payload.description)}</p>` : '',
    list.length
      ? `<div class="emb-fields${inline ? ' inline' : ''}">${list.map((field) => `
          <div class="emb-field"><strong>${escape(field.name)}</strong><span>${escape(field.value)}</span></div>`).join('')}</div>`
      : '',
    payload.footer ? `<div class="emb-footer">${escape(payload.footer.text)}</div>` : '',
  ].filter(Boolean).join('');
};

const v2Html = (payload) => {
  const parts = [
    payload.title ? `<div class="v2-title">${escape(payload.title)}</div>` : '',
    payload.author ? `<div class="v2-note">${escape(payload.author.name)}</div>` : '',
    payload.thumbnail ? `<img class="v2-thumb" src="${escape(payload.thumbnail.url)}" alt="">` : '',
    payload.description ? `<p class="v2-text">${escape(payload.description)}</p>` : '',
    ...(payload.fields ?? []).map((field) => `
      <div class="v2-field"><strong>${escape(field.name)}</strong><span>${escape(field.value)}</span></div>`),
    payload.footer ? `<div class="v2-note">${escape(payload.footer.text)}</div>` : '',
  ].filter(Boolean).join('');

  return `<div class="v2" style="--c:${colour()}">${parts}</div>`;
};

const frame = (inner) => `<div class="msg">
         <img class="msg-avatar" src="assets/pfp.png" alt="">
         <div class="msg-body">
           <div class="msg-meta"><span>slink</span><span class="badge">app</span><time>preview</time></div>
           ${inner}
         </div>
       </div>`;

const paint = () => {
  const payload = data();
  const list = payload.fields ?? [];

  output.textContent = JSON.stringify(mode === 'v2' ? container() : payload, null, 2);

  const empty = !payload.title && !payload.description && !list.length;

  preview.innerHTML = empty
    ? '<p class="preview-empty">nothing yet — a title or a description is enough to start.</p>'
    : frame(mode === 'v2'
      ? v2Html(payload)
      : `<div class="emb" style="--c:${colour()}">${embedHtml(payload)}</div>`);

  if (image) {
    const url = read('thumb').trim();
    image.hidden = !url;
    if (url) image.src = url;
  }

  const noFields = document.querySelector('#no-fields');
  if (noFields) noFields.hidden = document.querySelectorAll('.field-block').length > 0;

  for (const [key, max] of Object.entries(limits)) {
    const counter = document.querySelector(`[data-count="${key}"]`);
    const field = document.querySelector(`#${key}`);
    if (!counter || !field) continue;

    const used = field.value.length;
    counter.textContent = `${used}/${max}`;
    counter.classList.toggle('over', used > max);
  }
};

form?.addEventListener('input', paint);
form?.addEventListener('change', paint);

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    mode = button.dataset.mode;

    document.querySelectorAll('[data-mode]').forEach((other) => {
      other.setAttribute('aria-pressed', String(other === button));
    });

    if (hint) {
      hint.textContent = mode === 'v2'
        ? 'a container: once pasted into /embed it keeps this accent rail and posts as one message. 4000 characters per text block, 40 components in all.'
        : 'an embed: colour is an int, fields keep their inline flag. paste it into /embed — 6000 characters for the whole thing.';
    }

    paint();
  });
});

document.querySelector('#add-field')?.addEventListener('click', () => {
  const count = document.querySelectorAll('.field-block').length;
  if (count >= 25) return;

  const block = document.createElement('div');
  block.className = 'field-block';
  block.innerHTML = `
    <div class="row-2">
      <label class="field"><span>name</span><input class="input field-name" type="text" maxlength="256" placeholder="field name"></label>
      <label class="field"><span>value</span><input class="input field-value" type="text" maxlength="1024" placeholder="field value"></label>
      <button class="mini" type="button" data-remove aria-label="remove field">×</button>
    </div>
    <label class="field-inline-row"><input class="field-inline" type="checkbox"> inline</label>`;
  document.querySelector('#fields').append(block);
  block.querySelector('.field-name').focus();
});

document.querySelector('#fields')?.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-remove]');
  if (!remove) return;

  remove.closest('.field-block').remove();
  paint();
});

document.querySelector('#copy-json')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;

  try {
    await navigator.clipboard.writeText(output.textContent);
  } catch {
    return;
  }

  const label = button.querySelector('.copy-label');
  if (label) label.textContent = 'copied';
  button.classList.add('done');

  setTimeout(() => {
    button.classList.remove('done');
    if (label) label.textContent = 'copy json';
  }, 1500);
});

document.querySelector('#welcome-example')?.addEventListener('click', () => {
  document.querySelector('#author').value = 'slink';
  document.querySelector('#title').value = 'welcome in';
  document.querySelector('#desc').value = 'good to have you — grab a role from the picker and say hello below.\n\nquestions go in the chat, someone will answer.';
  document.querySelector('#footer').value = 'member 1,204';
  document.querySelector('#color').value = '#8d7bb4';
  document.querySelector('#thumb').value = '';
  document.querySelectorAll('.field-block').forEach((block) => block.remove());
  document.querySelectorAll('.dot-btn').forEach((dot) => {
    dot.setAttribute('aria-pressed', String(dot.dataset.color === '#8d7bb4'));
  });
  paint();
});

document.querySelector('#reset')?.addEventListener('click', () => {
  form.reset();
  document.querySelectorAll('.field-block').forEach((block) => block.remove());
  document.querySelectorAll('.dot-btn').forEach((dot) => dot.setAttribute('aria-pressed', 'false'));
  paint();
});

document.querySelectorAll('.dot-btn').forEach((dot) => {
  dot.addEventListener('click', () => {
    const input = document.querySelector('#color');
    input.value = dot.dataset.color;

    document.querySelectorAll('.dot-btn').forEach((other) => {
      other.setAttribute('aria-pressed', String(other === dot));
    });

    paint();
  });
});

paint();
