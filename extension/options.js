const $ = (id) => document.getElementById(id);
const KEYS = ['token', 'dbId', 'mwKey', 'stdictKey', 'ktermKey'];

chrome.storage.local.get(KEYS).then((v) => KEYS.forEach((k) => ($(k).value = v[k] ?? '')));

$('save').onclick = async () => {
  await chrome.storage.local.set(Object.fromEntries(KEYS.map((k) => [k, $(k).value.trim()])));
  $('msg').textContent = '저장됨';
};
