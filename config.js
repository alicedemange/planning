// =============================================================
//  Réglages du planning Cha'mania
//  Remplace les deux valeurs ci-dessous par celles de ton projet Supabase
//  (Supabase > Project Settings > API Keys / Data API).
//  Ces deux infos peuvent être publiques : la sécurité est assurée par la base.
//  Ne mets JAMAIS ici la clé "service_role" / "secret".
// =============================================================
window.CHAMANIA_CONFIG = {
  SUPABASE_URL: "https://szaxvtqnrhqficugyiju.supabase.co/rest/v1/",
  SUPABASE_KEY: "sb_publishable_7JdzTkkeL6LWs7y3dkaxxg_VcN_xALq",

  // Les filles se connectent avec un simple identifiant ("lea").
  // L'appli le transforme en "lea@chamania.local" : c'est l'adresse à utiliser
  // quand tu crées le compte dans Supabase.
  LOGIN_DOMAIN: "cm.local"
};
