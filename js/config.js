/* Nastavení provozovatele aplikace. Nic tajného: Client ID Google je veřejné a k datům pustí jen přihlášení uživatele.
   Žádná osobní data uživatelů sem nepatří – ta jsou v jejich vlastní tabulce. */
export const NASTAVENI = {
  googleClientId: '958006176041-c48re2bq5qlc12v5neav5e1p5jmlb793.apps.googleusercontent.com',
  nazevTabulky: 'Finance – data',
  // Google Picker (výběr existující tabulky z Disku). Veřejný klíč omezený na adresy aplikace a jen na Google Picker API.
  pickerKlic: 'AIzaSyCqG-dNKNi4BBPrDYzYYJHxOUju4aKTY3Q',
  // Číslo Google Cloud projektu (pro Picker).
  cisloProjektu: '958006176041'
};
