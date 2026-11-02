import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Jeu de donnees de demonstration.
 *
 * Le seed est idempotent : il peut etre relance sans dupliquer les donnees.
 * Les entites metier sont recreees a chaque passage pour l'agence de demo,
 * afin que le jeu de donnees reste coherent apres une evolution du schema.
 */
async function main() {
  console.log('Debut du seed...');

  const passwordHash = await hash('password123', 12);

  // ----------------------------------------------------------------
  // 1. Super Admin
  // ----------------------------------------------------------------
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@aqar.dz' },
    update: {},
    create: {
      email: 'superadmin@aqar.dz',
      name: 'Super Admin',
      password: passwordHash,
      role: 'super_admin',
      isActive: true,
    },
  });
  console.log('Super admin :', superAdmin.email);

  // ----------------------------------------------------------------
  // 2. Agence de demonstration (active)
  // ----------------------------------------------------------------
  const agency = await prisma.agency.upsert({
    where: { email: 'demo@aqar.dz' },
    update: {
      slug: 'agence-demo',
      showcaseEnabled: true,
      description:
        "Agence immobilière implantée à Alger depuis 2010, spécialisée dans la vente et la location de biens résidentiels et commerciaux sur le Grand Alger.",
    },
    create: {
      name: 'Agence Démo',
      email: 'demo@aqar.dz',
      phone: '+213 555 123 456',
      address: '123 Rue Didouche Mourad',
      wilaya: 'Alger',
      commune: 'Alger Centre',
      status: 'active',
      // Etait 'premium', que la migration 20260815000000 traduit en 'pro'.
      // La graine dit la meme chose que la base migree, sinon rejouer la
      // graine ferait diverger le decor de la suite E2E.
      plan: 'pro',
      slug: 'agence-demo',
      showcaseEnabled: true,
      description:
        "Agence immobilière implantée à Alger depuis 2010, spécialisée dans la vente et la location de biens résidentiels et commerciaux sur le Grand Alger.",
    },
  });
  console.log('Agence :', agency.name);

  // ----------------------------------------------------------------
  // 3. Deuxieme agence, en attente d'activation
  //    Sert a verifier que le blocage des agences non activees fonctionne.
  // ----------------------------------------------------------------
  const pendingAgency = await prisma.agency.upsert({
    where: { email: 'attente@aqar.dz' },
    update: {},
    create: {
      name: 'Agence en attente',
      email: 'attente@aqar.dz',
      phone: '+213 555 987 654',
      wilaya: 'Oran',
      commune: 'Oran Centre',
      status: 'pending',
      // Etait 'basic' → 'starter', meme raison qu'au-dessus.
      plan: 'starter',
      slug: 'agence-en-attente',
    },
  });

  await prisma.user.upsert({
    where: { email: 'attente@aqar.dz' },
    update: {},
    create: {
      email: 'attente@aqar.dz',
      name: 'Admin En Attente',
      password: passwordHash,
      role: 'agency_admin',
      agencyId: pendingAgency.id,
      isActive: true,
    },
  });
  console.log('Agence en attente :', pendingAgency.name);

  // ----------------------------------------------------------------
  // 4. Utilisateurs de l'agence de demo
  // ----------------------------------------------------------------
  const agencyAdmin = await prisma.user.upsert({
    where: { email: 'admin@aqar.dz' },
    update: { agencyId: agency.id },
    create: {
      email: 'admin@aqar.dz',
      name: 'Admin Agence',
      password: passwordHash,
      role: 'agency_admin',
      agencyId: agency.id,
      isActive: true,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@aqar.dz' },
    update: { agencyId: agency.id },
    create: {
      email: 'agent@aqar.dz',
      name: 'Karim Benali',
      password: passwordHash,
      role: 'agent',
      agencyId: agency.id,
      isActive: true,
    },
  });
  console.log('Utilisateurs :', agencyAdmin.email, '/', agent.email);

  // ----------------------------------------------------------------
  // 5. Remise a zero des donnees metier de l'agence de demo
  // ----------------------------------------------------------------
  await prisma.$transaction([
    prisma.rentalManagement.deleteMany({ where: { rental: { agencyId: agency.id } } }),
    prisma.payment.deleteMany({ where: { agencyId: agency.id } }),
    prisma.interaction.deleteMany({ where: { agencyId: agency.id } }),
    prisma.lead.deleteMany({ where: { agencyId: agency.id } }),
    prisma.visit.deleteMany({ where: { agencyId: agency.id } }),
    prisma.sale.deleteMany({ where: { agencyId: agency.id } }),
    prisma.rental.deleteMany({ where: { agencyId: agency.id } }),
    prisma.document.deleteMany({ where: { agencyId: agency.id } }),
    /*
      LES TROIS SEULS `deleteMany()` AUTORISES HORS DE LA CORBEILLE.

      La regle ESLint de `.eslintrc.json` les refuse partout ailleurs
      (story 3.5, REP-99). Ils sont legitimes ici parce que la graine
      REMET A ZERO l'agence de demonstration : elle ne « supprime » pas,
      elle reconstruit un decor connu, et un `deletedAt` y laisserait des
      lignes fantomes que la graine recreerait a cote.

      L'ordre ci-dessus n'est pas decoratif : les enfants partent avant
      leurs parents pour que la transaction ne depende pas des cascades.
      Ce qu'elles emporteraient est recense par `npm run audit:cascades`.
    */
    // eslint-disable-next-line no-restricted-syntax -- remise a zero du decor de demonstration
    prisma.property.deleteMany({ where: { agencyId: agency.id } }),
    // eslint-disable-next-line no-restricted-syntax -- idem
    prisma.client.deleteMany({ where: { agencyId: agency.id } }),
    // eslint-disable-next-line no-restricted-syntax -- idem
    prisma.owner.deleteMany({ where: { agencyId: agency.id } }),
  ]);

  // ----------------------------------------------------------------
  // 6. Proprietaires
  // ----------------------------------------------------------------
  const owners = await Promise.all(
    [
      {
        firstName: 'Mohamed',
        lastName: 'Cherif',
        phone: '+213 661 112 233',
        email: 'm.cherif@example.dz',
        address: '15 Rue Larbi Ben Mhidi, Alger Centre',
        idCardNumber: '160123456789',
        notes: 'Proprietaire de plusieurs biens sur Alger Centre. Prefere les contacts par telephone.',
      },
      {
        firstName: 'Fatima',
        lastName: 'Boumediene',
        phone: '+213 770 445 566',
        email: 'f.boumediene@example.dz',
        address: '8 Boulevard Zighoud Youcef, Alger',
        idCardNumber: '160987654321',
        notes: 'Confie la gestion locative complete a l agence.',
      },
      {
        firstName: 'Ahmed',
        lastName: 'Zerrouki',
        phone: '+213 555 778 899',
        email: 'a.zerrouki@example.dz',
        address: 'Cite des Anassers, Kouba',
        notes: 'Souhaite vendre rapidement.',
      },
    ].map((data) => prisma.owner.create({ data: { ...data, agencyId: agency.id } }))
  );
  console.log('Proprietaires :', owners.length);

  // ----------------------------------------------------------------
  // 7. Biens
  // ----------------------------------------------------------------
  const propertySeeds: Array<{
    data: Prisma.PropertyCreateWithoutAgencyInput
    ownerIndex: number
  }> = [
    {
      ownerIndex: 0,
      data: {
        title: 'Appartement F3 lumineux — Alger Centre',
        category: 'residentiel',
        type: 'appartement',
        operationType: 'vente',
        status: 'disponible',
        salePrice: new Prisma.Decimal(18500000),
        wilaya: 'Alger',
        commune: 'Alger Centre',
        quartier: 'Didouche Mourad',
        address: '42 Rue Didouche Mourad',
        surface: 95,
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        floor: 3,
        totalFloors: 6,
        hasTerrace: true,
        commission: new Prisma.Decimal(2.5),
        shortDescription: "F3 traversant au cœur d'Alger, proche de toutes commodités.",
        description:
          "Bel appartement F3 de 95 m2 situe au 3e etage d un immeuble de standing en plein centre d Alger. Sejour double lumineux donnant sur une terrasse, deux chambres spacieuses, cuisine equipee et salle de bain renovee. Immeuble avec ascenseur, proche des transports, commerces et ecoles.",
      },
    },
    {
      ownerIndex: 1,
      data: {
        title: 'Villa avec jardin — Hydra',
        category: 'residentiel',
        type: 'villa',
        operationType: 'vente',
        status: 'disponible',
        salePrice: new Prisma.Decimal(85000000),
        wilaya: 'Alger',
        commune: 'Hydra',
        quartier: 'Val d Hydra',
        address: '12 Chemin Cheikh Bachir El Ibrahimi',
        surface: 320,
        rooms: 7,
        bedrooms: 4,
        bathrooms: 3,
        totalFloors: 2,
        hasGarage: true,
        hasGarden: true,
        hasTerrace: true,
        commission: new Prisma.Decimal(2),
        shortDescription: 'Villa de standing sur 320 m² avec jardin arboré et garage double.',
        description:
          "Magnifique villa sur deux niveaux dans le quartier prise d Hydra. Vaste sejour avec cheminee, cuisine americaine equipee, quatre chambres dont une suite parentale, trois salles de bain. Jardin arbore de 200 m2, garage double, systeme de securite. Environnement calme et residentiel.",
      },
    },
    {
      ownerIndex: 1,
      data: {
        title: 'Studio meublé — Bab Ezzouar',
        category: 'residentiel',
        type: 'studio',
        operationType: 'gestion_locative',
        status: 'loue',
        rentPrice: new Prisma.Decimal(35000),
        wilaya: 'Alger',
        commune: 'Bab Ezzouar',
        quartier: 'Cite AADL',
        address: 'Bat C4, Cite AADL',
        surface: 38,
        rooms: 1,
        bedrooms: 1,
        bathrooms: 1,
        floor: 2,
        isFurnished: true,
        commission: new Prisma.Decimal(8),
        shortDescription: "Studio meublé idéal étudiant, proche de l'université USTHB.",
        description:
          "Studio entierement meuble et equipe de 38 m2, situe a proximite immediate de l universite USTHB et de la station de metro. Ideal pour un etudiant ou un jeune actif. Charges de copropriete incluses.",
      },
    },
    {
      ownerIndex: 2,
      data: {
        title: 'Local commercial 120 m² — Kouba',
        category: 'commercial',
        type: 'local_commercial',
        operationType: 'location',
        status: 'disponible',
        rentPrice: new Prisma.Decimal(120000),
        wilaya: 'Alger',
        commune: 'Kouba',
        address: '5 Rue des Freres Bouadou',
        surface: 120,
        floor: 0,
        commission: new Prisma.Decimal(10),
        shortDescription: 'Local commercial en rez-de-chaussée sur axe passant.',
        description:
          "Local commercial de 120 m2 en rez-de-chaussee avec vitrine sur rue passante. Deux acces, reserve, sanitaires. Convient pour commerce de detail, agence ou showroom. Bail commercial 3-6-9.",
      },
    },
    {
      ownerIndex: 0,
      data: {
        title: 'Duplex F5 avec terrasse — Aïn Benian',
        category: 'residentiel',
        type: 'duplex',
        operationType: 'vente',
        status: 'reserve',
        salePrice: new Prisma.Decimal(32000000),
        wilaya: 'Alger',
        commune: 'Ain Benian',
        surface: 165,
        rooms: 5,
        bedrooms: 3,
        bathrooms: 2,
        floor: 4,
        totalFloors: 5,
        hasGarage: true,
        hasTerrace: true,
        commission: new Prisma.Decimal(2.5),
        shortDescription: 'Duplex F5 avec grande terrasse et vue mer.',
        description:
          "Duplex de 165 m2 aux deux derniers etages, offrant une vue degagee sur la mer depuis sa terrasse de 40 m2. Trois chambres, deux salles de bain, double sejour. Place de parking en sous-sol.",
      },
    },
    {
      ownerIndex: 2,
      data: {
        title: 'Bureau 60 m² — Chéraga',
        category: 'professionnel',
        type: 'bureau',
        operationType: 'location',
        status: 'disponible',
        rentPrice: new Prisma.Decimal(90000),
        wilaya: 'Alger',
        commune: 'Cheraga',
        surface: 60,
        rooms: 3,
        floor: 5,
        commission: new Prisma.Decimal(10),
        shortDescription: 'Bureau équipé dans un immeuble professionnel récent.',
        description:
          "Plateau de bureaux de 60 m2 au 5e etage d un immeuble professionnel recent a Cheraga. Climatisation, fibre optique, parking visiteurs, gardiennage 24h/24. Trois espaces de travail cloisonnes.",
      },
    },
  ];

  const properties = [];
  for (const seed of propertySeeds) {
    const property = await prisma.property.create({
      data: {
        ...seed.data,
        agency: { connect: { id: agency.id } },
        owner: { connect: { id: owners[seed.ownerIndex].id } },
      },
    });
    properties.push(property);
  }
  // Photos de demonstration.
  //
  // Trois visuels seulement : ils tournent de facon a ce que deux biens
  // voisins dans la grille n'affichent jamais la meme image. La photo du
  // patio est ecartee ici — prise a travers une grille, elle est trop
  // sombre en vignette ; elle sert de bandeau a la vitrine.
  const DEMO_PHOTOS = [
    '/images/casbah-interieur.jpg',
    '/images/villa.jpg',
    '/images/interior.jpg',
  ];

  await prisma.propertyImage.createMany({
    data: properties.flatMap((property, index) =>
      DEMO_PHOTOS.map((_, offset) => ({
        propertyId: property.id,
        url: DEMO_PHOTOS[(index + offset) % DEMO_PHOTOS.length],
        isMain: offset === 0,
        sortOrder: offset,
      }))
    ),
  });

  console.log('Biens :', properties.length, '(3 photos chacun)');

  // ----------------------------------------------------------------
  // 8. Clients
  // ----------------------------------------------------------------
  const clients = await Promise.all(
    [
      {
        firstName: 'Sofiane',
        lastName: 'Haddad',
        phone: '+213 661 234 567',
        email: 's.haddad@example.dz',
        budget: new Prisma.Decimal(20000000),
        propertyType: 'appartement' as const,
        category: 'residentiel' as const,
        wilaya: 'Alger',
        type: 'acheteur' as const,
        status: 'client_chaud' as const,
        notes: 'Cherche un F3 sur Alger Centre. Financement bancaire en cours de validation.',
      },
      {
        firstName: 'Amina',
        lastName: 'Belkacem',
        phone: '+213 770 345 678',
        email: 'a.belkacem@example.dz',
        budget: new Prisma.Decimal(40000),
        propertyType: 'studio' as const,
        category: 'residentiel' as const,
        wilaya: 'Alger',
        type: 'locataire' as const,
        status: 'conclu' as const,
        notes: 'Etudiante en medecine. Bail signe pour le studio de Bab Ezzouar.',
      },
      {
        firstName: 'Yacine',
        lastName: 'Meziane',
        phone: '+213 555 456 789',
        email: 'y.meziane@example.dz',
        budget: new Prisma.Decimal(90000000),
        propertyType: 'villa' as const,
        category: 'residentiel' as const,
        wilaya: 'Alger',
        type: 'investisseur' as const,
        status: 'visite_prevue' as const,
        notes: 'Investisseur, interesse par la villa de Hydra. Paiement comptant possible.',
      },
      {
        firstName: 'Nadia',
        lastName: 'Ouali',
        phone: '+213 661 567 890',
        email: 'n.ouali@example.dz',
        budget: new Prisma.Decimal(130000),
        propertyType: 'local_commercial' as const,
        category: 'commercial' as const,
        wilaya: 'Alger',
        type: 'locataire' as const,
        status: 'interesse' as const,
        notes: 'Souhaite ouvrir une parapharmacie. Cherche un local avec vitrine.',
      },
      {
        firstName: 'Riad',
        lastName: 'Tounsi',
        phone: '+213 770 678 901',
        budget: new Prisma.Decimal(35000000),
        wilaya: 'Alger',
        type: 'acheteur' as const,
        status: 'nouveau' as const,
        notes: 'Premier contact recu via la vitrine en ligne.',
      },
    ].map((data) => prisma.client.create({ data: { ...data, agencyId: agency.id } }))
  );
  console.log('Clients :', clients.length);

  // ----------------------------------------------------------------
  // 9. Visites (passees avec retour structure, et a venir)
  // ----------------------------------------------------------------
  const today = new Date();
  const dayOffset = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  await prisma.visit.createMany({
    data: [
      {
        date: dayOffset(-12),
        time: '10:00',
        clientId: clients[0].id,
        propertyId: properties[0].id,
        agentId: agent.id,
        status: 'effectuee',
        interestLevel: 'tres_interesse',
        rating: 5,
        priceFeedback: 'Prix juge coherent avec le marche du quartier.',
        followUpDate: dayOffset(2),
        result: 'Le client a beaucoup apprecie la luminosite et la terrasse. Souhaite faire une offre.',
        agencyId: agency.id,
      },
      {
        date: dayOffset(-6),
        time: '14:30',
        clientId: clients[2].id,
        propertyId: properties[1].id,
        agentId: agent.id,
        status: 'effectuee',
        interestLevel: 'interesse',
        rating: 4,
        priceFeedback: 'Trouve le prix un peu eleve, evoque une negociation a 80 M.',
        followUpDate: dayOffset(1),
        result: 'Visite positive. Le client demande un second passage avec son epouse.',
        agencyId: agency.id,
      },
      {
        date: dayOffset(-3),
        time: '11:00',
        clientId: clients[3].id,
        propertyId: properties[3].id,
        status: 'effectuee',
        interestLevel: 'mitige',
        rating: 2,
        priceFeedback: 'Loyer juge trop eleve pour la surface utile.',
        result: 'La cliente trouve la reserve trop petite pour son activite.',
        agencyId: agency.id,
      },
      {
        date: dayOffset(1),
        time: '09:30',
        clientId: clients[2].id,
        propertyId: properties[1].id,
        agentId: agent.id,
        status: 'prevue',
        notes: 'Second passage avec l epouse du client.',
        agencyId: agency.id,
      },
      {
        date: dayOffset(3),
        time: '16:00',
        clientId: clients[4].id,
        propertyId: properties[4].id,
        agentId: agent.id,
        status: 'prevue',
        notes: 'Premiere visite. Client venu par la vitrine en ligne.',
        agencyId: agency.id,
      },
    ],
  });
  console.log('Visites : 5');

  // ----------------------------------------------------------------
  // 10. Vente
  // ----------------------------------------------------------------
  const sale = await prisma.sale.create({
    data: {
      propertyId: properties[4].id,
      clientId: clients[0].id,
      ownerId: owners[0].id,
      finalPrice: new Prisma.Decimal(31000000),
      commission: new Prisma.Decimal(775000),
      saleDate: dayOffset(-20),
      status: 'compromis',
      agencyId: agency.id,
    },
  });
  console.log('Vente : compromis signe');

  // ----------------------------------------------------------------
  // 11. Location + gestion locative sur 4 mois
  // ----------------------------------------------------------------
  const rental = await prisma.rental.create({
    data: {
      propertyId: properties[2].id,
      clientId: clients[1].id,
      ownerId: owners[1].id,
      startDate: dayOffset(-120),
      endDate: dayOffset(245),
      monthlyRent: new Prisma.Decimal(35000),
      deposit: new Prisma.Decimal(70000),
      agencyFees: new Prisma.Decimal(35000),
      status: 'active',
      agencyId: agency.id,
    },
  });

  // Quatre mois de quittances : les trois premiers encaisses, le dernier non.
  const managements = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const rentAmount = 35000;
    const commission = Math.round(rentAmount * 0.08);
    const charges = i === 0 ? 0 : 2000;
    const expenses = i === 2 ? 8500 : 0;
    const isPaid = i > 0;

    managements.push({
      rentalId: rental.id,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      rentAmount: new Prisma.Decimal(rentAmount),
      charges: charges > 0 ? new Prisma.Decimal(charges) : null,
      expenses: expenses > 0 ? new Prisma.Decimal(expenses) : null,
      commission: new Prisma.Decimal(commission),
      amountToOwner: new Prisma.Decimal(rentAmount + charges - expenses - commission),
      isPaid,
      paymentDate: isPaid ? new Date(d.getFullYear(), d.getMonth(), 5) : null,
      notes: expenses > 0 ? 'Reparation du chauffe-eau avancee par l agence.' : null,
    });
  }

  await prisma.rentalManagement.createMany({ data: managements });
  console.log('Gestion locative :', managements.length, 'mois');

  // ----------------------------------------------------------------
  // 12. Paiements rattaches
  // ----------------------------------------------------------------
  await prisma.payment.createMany({
    data: [
      {
        amount: new Prisma.Decimal(70000),
        type: 'caution',
        date: dayOffset(-120),
        method: 'cash',
        status: 'paye',
        propertyId: properties[2].id,
        clientId: clients[1].id,
        rentalId: rental.id,
        notes: 'Depot de garantie equivalent a deux mois de loyer.',
        agencyId: agency.id,
      },
      {
        amount: new Prisma.Decimal(35000),
        type: 'frais_dossier',
        date: dayOffset(-120),
        method: 'cash',
        status: 'paye',
        propertyId: properties[2].id,
        clientId: clients[1].id,
        rentalId: rental.id,
        notes: 'Frais d agence a la signature du bail.',
        agencyId: agency.id,
      },
      {
        amount: new Prisma.Decimal(2800),
        type: 'commission_agence',
        date: dayOffset(-30),
        method: 'virement',
        status: 'paye',
        propertyId: properties[2].id,
        rentalId: rental.id,
        notes: 'Commission de gestion du mois.',
        agencyId: agency.id,
      },
      {
        amount: new Prisma.Decimal(32200),
        type: 'paiement_proprietaire',
        date: dayOffset(-28),
        method: 'virement',
        status: 'paye',
        propertyId: properties[2].id,
        ownerId: owners[1].id,
        rentalId: rental.id,
        notes: 'Reversement du loyer net au proprietaire.',
        agencyId: agency.id,
      },
      {
        amount: new Prisma.Decimal(1000000),
        type: 'avance',
        date: dayOffset(-20),
        method: 'ccp',
        status: 'paye',
        propertyId: properties[4].id,
        clientId: clients[0].id,
        saleId: sale.id,
        notes: 'Avance versee a la signature du compromis.',
        agencyId: agency.id,
      },
      {
        amount: new Prisma.Decimal(775000),
        type: 'commission_agence',
        date: dayOffset(-20),
        method: 'virement',
        status: 'partiel',
        propertyId: properties[4].id,
        clientId: clients[0].id,
        saleId: sale.id,
        notes: 'Commission sur la vente, solde a percevoir a l acte authentique.',
        agencyId: agency.id,
      },
    ],
  });
  console.log('Paiements : 6');

  // ----------------------------------------------------------------
  // 13. Historique des interactions
  // ----------------------------------------------------------------
  await prisma.interaction.createMany({
    data: [
      {
        type: 'appel',
        subject: 'Premier contact',
        content: 'Le client recherche un F3 sur Alger Centre, budget maximum 20 M DA.',
        date: dayOffset(-25),
        clientId: clients[0].id,
        authorId: agent.id,
        agencyId: agency.id,
      },
      {
        type: 'visite',
        subject: 'Visite de l appartement F3 Didouche Mourad',
        content: 'Tres bon retour. Le client evoque une offre proche du prix demande.',
        date: dayOffset(-12),
        clientId: clients[0].id,
        authorId: agent.id,
        agencyId: agency.id,
      },
      {
        type: 'relance',
        subject: 'Relance apres visite',
        content: 'Le client confirme son interet, attend l accord de sa banque.',
        date: dayOffset(-8),
        clientId: clients[0].id,
        authorId: agent.id,
        agencyId: agency.id,
      },
      {
        type: 'rendez_vous',
        subject: 'Signature du compromis',
        content: 'Compromis signe en agence. Avance de 1 000 000 DA versee.',
        date: dayOffset(-20),
        clientId: clients[0].id,
        authorId: agencyAdmin.id,
        agencyId: agency.id,
      },
      {
        type: 'email',
        subject: 'Envoi du dossier de location',
        content: 'Contrat de bail et etat des lieux transmis par courriel.',
        date: dayOffset(-118),
        clientId: clients[1].id,
        authorId: agent.id,
        agencyId: agency.id,
      },
      {
        type: 'appel',
        subject: 'Point mensuel gestion locative',
        content: 'Le proprietaire est informe de la reparation du chauffe-eau.',
        date: dayOffset(-55),
        ownerId: owners[1].id,
        authorId: agencyAdmin.id,
        agencyId: agency.id,
      },
      {
        type: 'note',
        subject: 'Mandat de vente a renouveler',
        content: 'Le mandat exclusif arrive a echeance dans deux mois.',
        date: dayOffset(-10),
        ownerId: owners[2].id,
        authorId: agencyAdmin.id,
        agencyId: agency.id,
      },
    ],
  });
  console.log('Interactions : 7');

  // ----------------------------------------------------------------
  // 14. Messages recus depuis la vitrine publique
  // ----------------------------------------------------------------
  await prisma.lead.createMany({
    data: [
      {
        firstName: 'Karima',
        lastName: 'Slimani',
        phone: '+213 661 999 888',
        email: 'k.slimani@example.dz',
        message:
          'Bonjour, je suis interessee par la villa de Hydra. Serait-il possible d organiser une visite ce week-end ? Merci.',
        status: 'nouveau',
        propertyId: properties[1].id,
        agencyId: agency.id,
      },
      {
        firstName: 'Omar',
        lastName: 'Ferhat',
        phone: '+213 770 111 222',
        message:
          'Je cherche un local commercial d environ 100 m2 sur Kouba ou Bir Mourad Rais. Avez-vous d autres biens disponibles ?',
        status: 'nouveau',
        agencyId: agency.id,
      },
      {
        firstName: 'Riad',
        lastName: 'Tounsi',
        phone: '+213 770 678 901',
        message: 'Bonjour, le duplex de Ain Benian est-il toujours disponible ?',
        status: 'traite',
        propertyId: properties[4].id,
        agencyId: agency.id,
      },
    ],
  });
  console.log('Messages vitrine : 3');

  console.log('Seed termine.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
