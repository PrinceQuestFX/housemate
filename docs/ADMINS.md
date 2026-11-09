# Créer les comptes initiaux (Prince, Jordan et les 3 membres)
1. Renseigner `.env.local` (URL Supabase + clé service_role, jamais commitée).
2. Lancer :
   HOUSEMATE_USERS="prince@mail:Prince:Nom:admin,jordan@mail:Jordan:Nom:admin,a@mail:Prenom:Nom:member,b@mail:Prenom:Nom:member,c@mail:Prenom:Nom:member" \
   npx tsx --env-file=.env.local scripts/bootstrap-admins.ts
3. Noter les mots de passe temporaires affichés, puis chacun les change via « Mot de passe oublié ».
