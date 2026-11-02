# Planning réseaux Cha'mania : mise en ligne

L'appli tourne gratuitement avec :
- **GitHub Pages** pour le site ;
- **Supabase** (offre gratuite, sans carte bancaire) pour la base de données, les comptes et les photos.

Compte environ 20 minutes la première fois.

---

## Étape 1 : créer le projet Supabase

1. Va sur **supabase.com** et crée un compte, idéalement avec l'adresse e-mail de l'association.
2. Clique sur **New project** :
   - Nom : `chamania`
   - Mot de passe de la base : clique sur « Generate » et **garde-le précieusement** (dans un gestionnaire de mots de passe par exemple).
   - Région : **Europe (Paris ou Francfort)**
   - Plan : **Free**
3. Attends 1 à 2 minutes que le projet soit prêt.

## Étape 2 : créer la base (un copier-coller)

1. Dans le menu de gauche : **SQL Editor** › **New query**.
2. Ouvre le fichier `supabase/schema.sql`, copie **tout** son contenu et colle-le.
3. Clique sur **Run**. Le message attendu est « Success. No rows returned ».

Ce script crée les tables, la sécurité (seules les personnes connectées voient et modifient le planning), l'espace photos et les mises à jour en direct.

## Étape 3 : fermer les inscriptions publiques

Sans cette étape, n'importe qui pourrait se créer un compte.

**Authentication** › **Sign In / Providers** (ou **Settings**) › désactive **Allow new users to sign up** › **Save**.

## Étape 4 : créer les comptes

**Crée le tien en premier** : le tout premier compte devient automatiquement administratrice.

Pour chaque personne : **Authentication** › **Users** › **Add user** › **Create new user**
- **Email** : `identifiant@chamania.local`, par exemple `alice@chamania.local` ou `lea@chamania.local`.
  Ce n'est pas une vraie adresse : c'est juste le format que demande Supabase.
- **Password** : un mot de passe provisoire (8 caractères minimum).
- **Coche « Auto Confirm User »**, sinon le compte reste bloqué.

Chacune se connecte ensuite avec son **identifiant** (`lea`) et ce mot de passe. Elle peut changer son prénom affiché, sa couleur et son mot de passe dans **Mon compte**.

- **Mot de passe oublié :** dans **Users**, clique sur la personne › **Reset password** n'enverra rien (fausse adresse). Le plus simple est de supprimer le compte et de le recréer avec le même identifiant. Ses posts restent, seule l'attribution « qui poste » est à refaire.
- **Si tu n'es pas administratrice** (si un compte a été créé avant le tien) : **Table Editor** › `profiles` › mets `is_admin` à `true` sur ta ligne.

## Étape 5 : brancher l'appli

1. Dans Supabase : **Project Settings** › **API Keys** (et **Data API** pour l'adresse).
2. Ouvre `config.js` et remplace :
   - `https://VOTRE-PROJET.supabase.co` par la **Project URL** ;
   - `VOTRE-CLE-PUBLIQUE` par la clé **publishable** (`sb_publishable_…`) ou, à défaut, la clé **anon public**.
3. **Ne mets jamais** la clé `service_role` / `secret` dans ce fichier.

## Étape 6 : mettre le site en ligne sur GitHub Pages

1. Crée un compte sur **github.com** (pour l'asso), puis **New repository** :
   - Nom : `planning` (l'adresse sera `https://NOM-DU-COMPTE.github.io/planning/`)
   - **Public** (obligatoire pour GitHub Pages gratuit ; le code est visible mais les données restent protégées)
2. Dans le dépôt : **Add file** › **Upload files** › glisse `index.html`, `config.js`, `README.md` et le dossier `supabase` › **Commit changes**.
3. Ajoute la tâche anti-pause : **Add file** › **Create new file** › nom du fichier : `.github/workflows/keepalive.yml` (en tapant le nom, les `/` créent les dossiers) › colle le contenu du fichier `keepalive.yml` › **Commit changes**.
   On le crée à la main parce que les dossiers qui commencent par un point sont souvent cachés et ne partent pas en glisser-déposer.
4. **Settings** › **Pages** › Source : **Deploy from a branch** › Branch : `main` / `(root)` › **Save**.
5. Après 1 à 2 minutes, l'adresse du site s'affiche en haut de cette page. Partage-la à l'équipe.

**Astuce téléphone :** sur iPhone (Safari) ou Android (Chrome), ouvre le site puis **Partager › Sur l'écran d'accueil**. L'appli s'ouvre alors comme une vraie application.

## Étape 7 : vérifier la tâche anti-pause

Supabase met en pause les projets gratuits après 7 jours sans activité. La tâche GitHub « fait signe » à la base tous les 3 jours.

- **Actions** › **Garder Supabase éveillé** › **Run workflow** pour la tester tout de suite. Une coche verte = tout va bien.
- **Si un jour le planning ne charge plus** (projet en pause) : connecte-toi à supabase.com et clique sur **Restore project**. Rien n'est perdu.

---

## Bon à savoir

- **Espace photos : 1 Go.** Les photos sont réduites automatiquement (environ 300 Ko chacune), soit de la place pour quelques milliers. Les vidéos sont limitées à 50 Mo : pour les reels, préfère un lien Google Drive.
- **Supprimer un post** supprime aussi ses visuels, ce qui libère de la place.
- **Voir l'espace utilisé :** dans Supabase › **Storage** et **Database**.
- **Tout le monde a les mêmes droits** sur les posts : créer, modifier, supprimer, cocher « publié », écrire des messages.
- **L'administratrice** peut en plus renommer les membres et changer leurs couleurs (bouton **Équipe**).
- **Sauvegarde :** dans **Table Editor** › `posts` › **Export to CSV**.
