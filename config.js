// =============================================================
//  Réglages du planning Cha'mania
//  Remplace les deux valeurs ci-dessous par celles de ton projet Supabase
//  (Supabase > Project Settings > Data API pour l'adresse, > API Keys pour la clé).
//  Ces deux infos peuvent être publiques : la sécurité est assurée par la base.
//  Ne mets JAMAIS ici la clé "service_role" / "secret".
// =============================================================
window.CHAMANIA_CONFIG = {
  SUPABASE_URL: "https://VOTRE-PROJET.supabase.co",
  SUPABASE_KEY: "VOTRE-CLE-PUBLIQUE",

  // Compte d'équipe créé par le script supabase/code-pin.sql (ne pas modifier)
  TEAM_EMAIL: "equipe@chamania.local",

  // Clé publique des notifications (ne pas modifier)
  VAPID_PUBLIC_KEY: "BMJiJS5CaDAu9a_J2QaL-tiT_vEszhrjjNay1iBfndKskMS2k5uTfyrdOFUXLlN30E1lm2QDo8QeCX3VIuxZ6Ng"
};
