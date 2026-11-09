# Installation et déploiement de HOUSEMATE

## 0. Prérequis
Node 20+, Git, Docker (pour Supabase en local), comptes GitHub, Supabase et Vercel.
    npm i -g vercel supabase gh        # ou installer chaque outil via brew/scoop

## 1. Projet
    npx create-next-app@latest housemate --ts --tailwind --app --src-dir --eslint --use-npm --import-alias "@/*"
    cd housemate
    npx shadcn@latest init -d --base radix
    npm install --save-exact @supabase/supabase-js @supabase/ssr web-push
    npm install --save-exact -D vitest tsx @types/web-push
    npm pkg set scripts.test="vitest run"
Dézipper housemate.zip PAR-DESSUS le dossier (accepter le remplacement des fichiers).

## 2. Local
    supabase init            # si supabase/config.toml n'existe pas
    supabase start
    supabase db reset        # applique les migrations 0001, 0002, 0003
    supabase test db         # tests de sécurité SQL (pgTAP)
    cp .env.example .env.local   # URL et clés affichées par `supabase start`
    npx web-push generate-vapid-keys   # recopier les clés dans .env.local
    npm test
    HOUSEMATE_USERS="mail1:Prince:Nom:admin,mail2:Jordan:Nom:admin,mail3:Prenom:Nom:member,mail4:Prenom:Nom:member,mail5:Prenom:Nom:member" \
      npx tsx --env-file=.env.local scripts/bootstrap-admins.ts
    npm run dev              # http://localhost:3000

## 3. Supabase en ligne
    supabase login
    supabase link --project-ref TON_REF
    supabase db push
Dans le tableau de bord Supabase :
- Authentication > Sign In / Providers : désactiver « Allow new users to sign up ».
- Authentication > URL Configuration : Site URL = URL Vercel ; ajouter <URL>/auth/callback aux Redirect URLs.
- Database > Webhooks > Create : table `notifications`, événement INSERT, type HTTP Request, POST
  https://TON-SITE/api/push/notify, en-tête x-webhook-secret = valeur de PUSH_WEBHOOK_SECRET.
- Database > Extensions : vérifier que pg_cron est activé (clôture mensuelle).
Créer les comptes sur la base en ligne : relancer la commande bootstrap avec les valeurs de production.

## 4. GitHub
    git init && git add . && git commit -m "HOUSEMATE"
    gh auth login
    gh repo create housemate --private --source=. --push

## 5. Vercel
    vercel login && vercel link
    for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SITE_URL \
             AI_PROVIDER AI_API_KEY AI_MODEL NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT PUSH_WEBHOOK_SECRET; do
      vercel env add $v production; done
    vercel --prod
Ensuite chaque `git push` redéploie automatiquement.

## 6. Installer sur le téléphone
Ouvrir le site, « Ajouter à l'écran d'accueil » (obligatoire sur iPhone pour les notifications push),
puis Réglages > Activer les notifications push.

## Dépannage
- Page blanche / redirection vers /login : vérifier NEXT_PUBLIC_SUPABASE_URL et la clé publishable.
- « Cette action a échoué » : une règle de la maison a refusé l'action (droits, état, montant).
- Photo refusée : JPEG/PNG/WebP, 4 Mo maximum.
- Pas de push : webhook Supabase, PUSH_WEBHOOK_SECRET et clés VAPID doivent correspondre.
