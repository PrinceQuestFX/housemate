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
  "month.congratulations": "Félicitations : 200 points sur le mois",
};
