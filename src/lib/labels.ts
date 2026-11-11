export const ROOMS: Record<string, string> = {
  kitchen: "Cuisine", living: "Salon", toilets: "Toilettes", bathroom: "Salle de bain",
  shower: "Douche", hallway: "Couloir", other: "Autres espaces communs",
};

export const INFRACTION_STATUS: Record<string, string> = {
  pending: "En attente", reviewing: "En cours d'examen", validated: "Validé",
  rejected: "Rejeté", contested: "Contesté", cancelled: "Annulé",
};

export const CATEGORIES: Record<string, string> = {
  groceries: "Courses", water: "Eau", electricity: "Électricité", internet: "Internet",
  rent: "Loyer", cleaning: "Produits ménagers", repairs: "Réparations", other: "Autres",
};

export const TRANSFER_STATUS: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmé", disputed: "Contesté", cancelled: "Annulé",
};

export const CLEANING_STATUS: Record<string, string> = {
  todo: "À faire", to_verify: "À vérifier", to_fix: "À corriger", validated: "Validée",
};

export const NOTIFICATION_KINDS: Record<string, string> = {
  "infraction.reported": "Nouveau signalement reçu",
  "cleaning.assigned": "Nouvelle tâche de nettoyage",
  "cleaning.to_verify": "Une tâche est à vérifier",
  "cleaning.validated": "Votre nettoyage a été validé",
  "cleaning.refused": "Votre nettoyage a été refusé",
  "infraction.validated": "Une sanction vous concernant a été validée par vote",
  "bonus.requested": "Une demande de bonus est à valider",
  "bonus.decided": "Une demande de bonus a été traitée",
  "month.congratulations": "Félicitations : 200 points sur le mois",
};

export const BONUS_STATUS: Record<string, string> = { pending: "En attente", approved: "Accepté", rejected: "Refusé" };

/** Traduit l'erreur renvoyée par la base en phrase claire. */
export function errorMessage(raw: string): string {
  const M: [string, string][] = [
    ["Could not find the function", "La base de données n'est pas à jour : appliquez la dernière migration (npx supabase db push --linked)."],
    ["accused_required", "Choisissez le membre concerné."],
    ["invalid_points", "Choisissez un nombre de points valide."],
    ["accused_cannot_vote", "Vous ne pouvez pas voter sur votre propre sanction."],
    ["duplicate key", "Vous avez déjà voté."],
    ["already_decided", "Cette décision est déjà prise."],
    ["cannot_decide_own", "Un autre administrateur doit valider cette demande."],
    ["reason_required", "Le motif est obligatoire."],
    ["forbidden", "Action non autorisée."],
    ["beneficiary_not_member", "Cette personne ne fait pas partie de la maison."],
    ["check constraint", "Valeur refusée par les règles de la maison."],
  ];
  return M.find(([k]) => raw.includes(k))?.[1] ?? `Cette action a échoué (${raw}).`;
}
