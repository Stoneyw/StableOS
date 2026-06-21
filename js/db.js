// StableOS — Client-Side Multi-Tenant Data Layer
// ----------------------------------------------------------------------------
// One company account per stable, fully isolated by companyId. Every record
// (users, horses, feeding, health, calendar, tasks, invoices, messages) carries
// a companyId and is read back scoped to the authenticated user's company —
// mirroring the server's tenant guard. Platform admins (super admin) sit OUTSIDE
// any company and can read/manage all of them.
//
// To connect the real Node/MySQL backend, swap each window.DB.* method body for
// a fetch('/api/...') call; the method names map 1:1 to the REST routes.
// ----------------------------------------------------------------------------

(function () {
  const STORE   = 'stableos_v3';        // bumped key → re-seeds with multi-tenant schema
  const AUTH    = 'stableos_auth_v2';   // tenant-user session
  const PADMIN  = 'stableos_padmin_v2'; // platform-admin session

  const PLAN_MRR = { Basic: 99, Professional: 199, Enterprise: 399 };

  // ── Seed builder ──────────────────────────────────────────────────────────
  // Company 1 (The Winners Stable) is authored in full. Companies 2–7 are
  // generated with a modest but real dataset so every tenant is explorable and
  // the super-admin's counts/MRR are computed from actual records.
  function buildSeed() {
    const TODAY = new Date().toISOString().split('T')[0];
    const S = {
      companies: [], users: [], horses: [], feedRations: [], feedLog: [],
      healthRecords: [], events: [], tasks: [], invoices: [], messages: [],
      platformAdmins: [
        { id: 1, name: 'Stoney W.', email: 'stoneyw@gmail.com', password: 'StableOS123', avatar: 'SW' }
      ]
    };

    // ── Company 1 — The Winners Stable (authored) ──
    S.companies.push({ id:1, name:"The Winners Stable", slug:"winners-stable", location:"Georgetown, TX", address:"123 Ranch Road, Georgetown, TX 78626", phone:"(512) 555-0100", website:"www.thewinnersstable.com", plan:"Professional", facilityType:"Boarding facility", status:"active", joined:"Jan 2024", ownerEmail:"chris@thewinnersstable.com" });
    S.users.push(
      { id:1,  companyId:1, name:"Chris",      email:"chris@thewinnersstable.com",  password:"StableOS123", role:"owner",   avatar:"CH", phone:"512-585-4092" },
      { id:2,  companyId:1, name:"Eileen",     email:"eileen@thewinnersstable.com", password:"stable123",   role:"manager", avatar:"EI", phone:"512-585-4092" },
      { id:3,  companyId:1, name:"Sam Okafor", email:"sam@thewinnersstable.com",    password:"stable123",   role:"trainer", avatar:"SO" },
      { id:4,  companyId:1, name:"Angela Crews",email:"angela@thewinnersstable.com",password:"stable123",   role:"trainer", avatar:"AC" },
      { id:5,  companyId:1, name:"Emily",      email:"emily@gmail.com",             password:"stable123",   role:"boarder", avatar:"EM" },
      { id:6,  companyId:1, name:"Christy",    email:"christy@gmail.com",           password:"stable123",   role:"boarder", avatar:"CH", phone:"512-767-8019" },
      { id:7,  companyId:1, name:"Stephanie",  email:"stephanie@gmail.com",         password:"stable123",   role:"boarder", avatar:"ST", phone:"512-468-3002" },
      { id:8,  companyId:1, name:"Laine",      email:"laine@gmail.com",             password:"stable123",   role:"boarder", avatar:"LA", phone:"512-567-3022" },
      { id:9,  companyId:1, name:"Laurel",     email:"laurel@gmail.com",            password:"stable123",   role:"boarder", avatar:"LA", phone:"214-901-8764" },
      { id:10, companyId:1, name:"Maddie",     email:"maddie@gmail.com",            password:"stable123",   role:"boarder", avatar:"MA", phone:"971-228-9916" },
      { id:11, companyId:1, name:"Mani",       email:"mani@gmail.com",              password:"stable123",   role:"boarder", avatar:"MA", phone:"254-624-0966" },
      { id:12, companyId:1, name:"Bri",        email:"bri@gmail.com",               password:"stable123",   role:"boarder", avatar:"BR", phone:"512-796-1931" },
      { id:13, companyId:1, name:"Charlie",    email:"charlie@gmail.com",           password:"stable123",   role:"boarder", avatar:"CH", phone:"512-549-0051" }
    );
    S.horses.push(
      { id:1,  companyId:1, name:"Georgia", breed:"Quarter Horse", coat:"Bay",      sex:"mare",    location:"Paddock W1",  boardType:"paddock", ownerId:5,    status:"active", notes:"" },
      { id:2,  companyId:1, name:"Sophie",  breed:"Quarter Horse", coat:"Chestnut", sex:"mare",    location:"Paddock W3",  boardType:"paddock", ownerId:6,    status:"active", notes:"" },
      { id:3,  companyId:1, name:"Alvin",   breed:"Quarter Horse", coat:"Bay",      sex:"gelding", location:"Paddock W3",  boardType:"paddock", ownerId:6,    status:"active", notes:"" },
      { id:4,  companyId:1, name:"Foxy",    breed:"Quarter Horse", coat:"Palomino", sex:"mare",    location:"Paddock W4",  boardType:"paddock", ownerId:7,    status:"active", notes:"" },
      { id:5,  companyId:1, name:"Rio",     breed:"Quarter Horse", coat:"Sorrel",   sex:"gelding", location:"Paddock W6",  boardType:"paddock", ownerId:8,    status:"active", notes:"" },
      { id:6,  companyId:1, name:"Pretzel", breed:"Quarter Horse", coat:"Grey",     sex:"gelding", location:"Paddock W7",  boardType:"paddock", ownerId:9,    status:"active", notes:"" },
      { id:7,  companyId:1, name:"Amali",   breed:"Quarter Horse", coat:"Bay",      sex:"mare",    location:"Paddock W7",  boardType:"paddock", ownerId:9,    status:"active", notes:"" },
      { id:8,  companyId:1, name:"Journey", breed:"Quarter Horse", coat:"Bay",      sex:"mare",    location:"Paddock W8",  boardType:"paddock", ownerId:10,   status:"active", notes:"" },
      { id:9,  companyId:1, name:"Santana", breed:"Quarter Horse", coat:"Sorrel",   sex:"gelding", location:"Paddock W9",  boardType:"paddock", ownerId:11,   status:"active", notes:"" },
      { id:10, companyId:1, name:"Malibu",  breed:"Quarter Horse", coat:"Palomino", sex:"mare",    location:"Paddock W10", boardType:"paddock", ownerId:12,   status:"active", notes:"" },
      { id:11, companyId:1, name:"Lena",    breed:"Quarter Horse", coat:"Bay",      sex:"mare",    location:"Paddock W12", boardType:"paddock", ownerId:1,    status:"active", notes:"" },
      { id:12, companyId:1, name:"Whiskey", breed:"Quarter Horse", coat:"Buckskin", sex:"gelding", location:"Paddock W12", boardType:"paddock", ownerId:1,    status:"active", notes:"" },
      { id:13, companyId:1, name:"Jig",     breed:"Quarter Horse", coat:"Bay",      sex:"gelding", location:"Stall 1",     boardType:"stall",   ownerId:1,    status:"active", notes:"" },
      { id:14, companyId:1, name:"Rohze",   breed:"Quarter Horse", coat:"Chestnut", sex:"gelding", location:"Stall 4",     boardType:"stall",   ownerId:1,    status:"active", notes:"" },
      { id:15, companyId:1, name:"Tess",    breed:"Quarter Horse", coat:"Grey",     sex:"mare",    location:"Stall 5",     boardType:"stall",   ownerId:1,    status:"active", notes:"" },
      { id:16, companyId:1, name:"Diamond", breed:"Quarter Horse", coat:"Black",    sex:"mare",    location:"Stall 3",     boardType:"stall",   ownerId:13,   status:"active", notes:"" },
      { id:17, companyId:1, name:"Ruby",    breed:"Quarter Horse", coat:"Bay",      sex:"mare",    location:"Stall 8",     boardType:"stall",   ownerId:13,   status:"active", notes:"" },
      { id:18, companyId:1, name:"Remy",    breed:"Quarter Horse", coat:"Sorrel",   sex:"gelding", location:"Stall 7",     boardType:"stall",   ownerId:null, status:"active", notes:"" }
    );
    S.feedRations.push(
      { id:1,  companyId:1, horseId:1,  meal:"am", ration:"\u00bd pellets",                                                                                                                                   notes:"" },
      { id:2,  companyId:1, horseId:1,  meal:"pm", ration:"\u00bd pellets",                                                                                                                                   notes:"" },
      { id:3,  companyId:1, horseId:2,  meal:"am", ration:"1 cup feed + 1 Smartpack",                                                                                                                        notes:"Owner provided supplements" },
      { id:4,  companyId:1, horseId:2,  meal:"pm", ration:"1 cup feed",                                                                                                                                      notes:"Owner provided supplements" },
      { id:5,  companyId:1, horseId:3,  meal:"am", ration:"80% cup feed",                                                                                                                                    notes:"Owner provided supplements" },
      { id:6,  companyId:1, horseId:3,  meal:"pm", ration:"80% cup feed",                                                                                                                                    notes:"Owner provided supplements" },
      { id:7,  companyId:1, horseId:4,  meal:"am", ration:"\u00bd scoop Thrive DRY (Thrive left bin / Timothy right)",                                                                                       notes:"" },
      { id:8,  companyId:1, horseId:4,  meal:"pm", ration:"\u00bd scoop Thrive DRY + \u2153 scoop Timothy Pellets SOAKED + \u00bd scoop magnesium + \u00bd scoop Apple Elean",                               notes:"" },
      { id:9,  companyId:1, horseId:5,  meal:"am", ration:"1\u00bd scoops DRY",                                                                                                                              notes:"" },
      { id:10, companyId:1, horseId:5,  meal:"pm", ration:"1 scoop DRY",                                                                                                                                     notes:"" },
      { id:11, companyId:1, horseId:6,  meal:"am", ration:"1 scoop pellets (white bin) + 1 scoop balancer (white bin), wet",                                                                                 notes:"" },
      { id:12, companyId:1, horseId:6,  meal:"pm", ration:"1 scoop pellets + 1.5 scoops copper (red bin), wet",                                                                                              notes:"" },
      { id:13, companyId:1, horseId:7,  meal:"am", ration:"1 scoop pellets (white bin) + 1 scoop balancer (white bin), wet",                                                                                 notes:"" },
      { id:14, companyId:1, horseId:7,  meal:"pm", ration:"1 scoop pellets + 1.5 scoops copper (red bin), wet",                                                                                              notes:"" },
      { id:15, companyId:1, horseId:8,  meal:"am", ration:"1 tub prepped grain (orange lid box) + 1 flake alfalfa",                                                                                          notes:"Owner provided supplements" },
      { id:16, companyId:1, horseId:8,  meal:"pm", ration:"1 flake alfalfa",                                                                                                                                 notes:"Owner provided supplements" },
      { id:17, companyId:1, horseId:9,  meal:"am", ration:"\u00bd cup Ration Balancer",                                                                                                                      notes:"" },
      { id:18, companyId:1, horseId:9,  meal:"pm", ration:"\u00bd cup Ration Balancer",                                                                                                                      notes:"" },
      { id:19, companyId:1, horseId:10, meal:"am", ration:"1 AM Bag Pre-Prepped + 1 Fluro Flexi-flex",                                                                                                       notes:"Owner provided supplements" },
      { id:20, companyId:1, horseId:10, meal:"pm", ration:"1 PM Bag Pre-Prepped + Soaked Alfalfa",                                                                                                           notes:"Owner provided supplements" },
      { id:21, companyId:1, horseId:11, meal:"am", ration:"See barn feed room",                                                                                                                               notes:"" },
      { id:22, companyId:1, horseId:11, meal:"pm", ration:"See barn feed room",                                                                                                                               notes:"" },
      { id:23, companyId:1, horseId:12, meal:"am", ration:"See barn feed room",                                                                                                                               notes:"" },
      { id:24, companyId:1, horseId:12, meal:"pm", ration:"See barn feed room",                                                                                                                               notes:"" }
    );
    S.healthRecords.push(
      { id:1,  companyId:1, horseId:1, type:"vaccination", title:"5-way + WNV",        performedOn:"2026-03-15", nextDueOn:"2027-03-15", provider:"Dr. Susan Hill", cost:85,  notes:"" },
      { id:2,  companyId:1, horseId:1, type:"farrier",     title:"Trim & shoe",        performedOn:"2026-05-20", nextDueOn:"2026-07-20", provider:"Jake Farrier",   cost:120, notes:"" },
      { id:3,  companyId:1, horseId:1, type:"coggins",     title:"Coggins / EIA Test", performedOn:"2026-01-10", nextDueOn:"2027-01-10", provider:"Dr. Susan Hill", cost:45,  notes:"" },
      { id:4,  companyId:1, horseId:2, type:"vaccination", title:"5-way + WNV",        performedOn:"2026-03-15", nextDueOn:"2027-03-15", provider:"Dr. Susan Hill", cost:85,  notes:"" },
      { id:5,  companyId:1, horseId:2, type:"farrier",     title:"Trim",               performedOn:"2026-06-01", nextDueOn:"2026-08-01", provider:"Jake Farrier",   cost:65,  notes:"" },
      { id:6,  companyId:1, horseId:13, type:"vet_visit",   title:"Lameness eval",      performedOn:"2026-05-10", nextDueOn:null,         provider:"Dr. Susan Hill", cost:220, notes:"Left front soreness, resolved" },
      { id:7,  companyId:1, horseId:4, type:"deworming",   title:"Ivermectin",         performedOn:"2026-04-01", nextDueOn:"2026-10-01", provider:null,             cost:12,  notes:"" },
      { id:8,  companyId:1, horseId:5, type:"dental",      title:"Float",              performedOn:"2026-02-20", nextDueOn:"2027-02-20", provider:"Dr. Ben Marsh",  cost:180, notes:"" },
      { id:9,  companyId:1, horseId:6, type:"farrier",     title:"Trim & shoe",        performedOn:"2026-05-28", nextDueOn:"2026-07-28", provider:"Jake Farrier",   cost:120, notes:"" },
      { id:10, companyId:1, horseId:7, type:"vaccination", title:"5-way + WNV",        performedOn:"2026-03-15", nextDueOn:"2027-03-15", provider:"Dr. Susan Hill", cost:85,  notes:"" }
    );
    S.events.push(
      { id:1, companyId:1, title:"Private lesson — Georgia",      type:"lesson",   arena:"Covered Arena", horseId:1,    staffId:3, startsAt:`${TODAY}T07:00:00`, endsAt:`${TODAY}T08:00:00`,  notes:"" },
      { id:2, companyId:1, title:"Groundwork · Round Pen — Foxy", type:"training", arena:"Round Pen 1",   horseId:4,    staffId:4, startsAt:`${TODAY}T09:30:00`, endsAt:`${TODAY}T10:30:00`,  notes:"" },
      { id:3, companyId:1, title:"Training ride — Santana",       type:"training", arena:"Covered Arena", horseId:9,    staffId:3, startsAt:`${TODAY}T14:00:00`, endsAt:`${TODAY}T15:00:00`,  notes:"" },
      { id:4, companyId:1, title:"Group lesson (3 riders)",       type:"lesson",   arena:"Outdoor Arena", horseId:null, staffId:3, startsAt:`${TODAY}T16:00:00`, endsAt:`${TODAY}T17:30:00`,  notes:"Sophie, Rio, Journey" }
    );
    S.tasks.push(
      { id:1, companyId:1, title:"Muck stalls 1–3",                          assigneeId:3, dueOn:TODAY, priority:"normal", done:false, doneAt:null },
      { id:2, companyId:1, title:"Drag arena after lessons",                  assigneeId:3, dueOn:TODAY, priority:"normal", done:false, doneAt:null },
      { id:3, companyId:1, title:"Restock fly spray — barn supply low",       assigneeId:2, dueOn:TODAY, priority:"high",   done:false, doneAt:null },
      { id:4, companyId:1, title:"Check water troughs in west paddocks",      assigneeId:4, dueOn:TODAY, priority:"normal", done:true,  doneAt:`${TODAY}T08:30:00` },
      { id:5, companyId:1, title:"Call Jake re: Pretzel's next shoeing date", assigneeId:2, dueOn:TODAY, priority:"normal", done:false, doneAt:null },
      { id:6, companyId:1, title:"Submit Coggins for Georgia — vet show",     assigneeId:2, dueOn:TODAY, priority:"high",   done:false, doneAt:null }
    );
    S.invoices.push(
      { id:1, companyId:1, boarderId:5,  horseId:1,  number:"INV-2026-001", period:"2026-06", amount:650, status:"paid",    dueOn:"2026-06-01", paidOn:"2026-06-02", lines:[{description:"Paddock board — Georgia (Jun)", qty:1, unitPrice:600},{description:"Farrier — trim & shoe", qty:1, unitPrice:50}] },
      { id:2, companyId:1, boarderId:6,  horseId:2,  number:"INV-2026-002", period:"2026-06", amount:600, status:"paid",    dueOn:"2026-06-01", paidOn:"2026-06-03", lines:[{description:"Paddock board — Sophie (Jun)",  qty:1, unitPrice:600}] },
      { id:3, companyId:1, boarderId:8,  horseId:5,  number:"INV-2026-003", period:"2026-06", amount:550, status:"sent",    dueOn:"2026-06-15", paidOn:null,          lines:[{description:"Paddock board — Rio (Jun)",    qty:1, unitPrice:500},{description:"Hay — Round bales",             qty:1, unitPrice:50}] },
      { id:4, companyId:1, boarderId:9,  horseId:6,  number:"INV-2026-004", period:"2026-06", amount:500, status:"overdue", dueOn:"2026-06-01", paidOn:null,          lines:[{description:"Paddock board — Pretzel (Jun)", qty:1, unitPrice:500}] },
      { id:5, companyId:1, boarderId:13, horseId:16, number:"INV-2026-005", period:"2026-06", amount:550, status:"sent",    dueOn:"2026-06-15", paidOn:null,          lines:[{description:"Stall board — Diamond (Jun)",   qty:1, unitPrice:550}] }
    );
    S.messages.push(
      { id:1, companyId:1, senderId:3, recipientId:null, body:"Arena drag done after group lesson. All horses looked great today!", readAt:null, createdAt:"2026-06-12T18:30:00" },
      { id:2, companyId:1, senderId:5, recipientId:2,    body:"Can Georgia have extra hay this week? She looks a bit thin.", readAt:null, createdAt:"2026-06-12T10:15:00" },
      { id:3, companyId:1, senderId:2, recipientId:null, body:"Reminder: Jake the farrier is scheduled for June 18th. Please have stall horses in by 7:30 AM.", readAt:"2026-06-11T09:00:00", createdAt:"2026-06-11T08:45:00" },
      { id:4, companyId:1, senderId:1, recipientId:null, body:"Welcome to The Winners Stable's new messaging system!", readAt:"2026-06-10T10:00:00", createdAt:"2026-06-10T09:00:00" }
    );

    // ── Companies 2–7 — generated tenants ──
    const cfgs = [
      { id:2, name:"Blue Creek Ranch",       slug:"blue-creek-ranch", location:"Austin, TX",        plan:"Enterprise",   status:"active",    joined:"Mar 2024", ownerName:"Margaret Dunn", ownerEmail:"margaret@bluecreekranch.com",     domain:"bluecreekranch.com",      arenas:["Covered Arena","Outdoor Arena","Round Pen 1"] },
      { id:3, name:"Hill Country Equine",    slug:"hill-country",     location:"Dripping Springs, TX", plan:"Professional", status:"active",  joined:"May 2024", ownerName:"Tom Bradley",   ownerEmail:"tom@hillcountryequine.com",       domain:"hillcountryequine.com",   arenas:["Main Arena","Round Pen 1"] },
      { id:4, name:"Southern Oaks Boarding", slug:"southern-oaks",    location:"Brenham, TX",       plan:"Basic",        status:"active",    joined:"Jun 2024", ownerName:"Linda Ashford", ownerEmail:"linda@southernoaks.com",          domain:"southernoaks.com",        arenas:["Main Arena"] },
      { id:5, name:"Lone Star Stables",      slug:"lone-star",        location:"Round Rock, TX",    plan:"Professional", status:"trial",     joined:"Jun 2026", ownerName:"Sam Rivera",    ownerEmail:"sam@lonestarstables.com",         domain:"lonestarstables.com",     arenas:["Covered Arena","Outdoor Arena"] },
      { id:6, name:"Bluebonnet Farms",       slug:"bluebonnet",       location:"Fredericksburg, TX", plan:"Basic",       status:"suspended", joined:"Feb 2024", ownerName:"Pat Owens",     ownerEmail:"pat@bluebonnetfarms.com",         domain:"bluebonnetfarms.com",     arenas:["Main Arena"] },
      { id:7, name:"Cedar Ridge Equestrian", slug:"cedar-ridge",      location:"Waco, TX",          plan:"Enterprise",   status:"active",    joined:"Nov 2023", ownerName:"Jill Carver",   ownerEmail:"jill@cedarridgeequestrian.com",   domain:"cedarridgeequestrian.com", arenas:["Covered Arena","Outdoor Arena","Round Pen 1","Round Pen 2"] }
    ];

    const HNAMES = ['Apollo','Willow','Scout','Daisy','Comanche','Luna','Ranger','Penny','Cisco','Maple','Duke','Ruby','Ace','Stella','Banjo','Clover','Cash','Hazel','Tucker','Gypsy','Boone','Indie','Rebel','Pearl','Chief','Birdie','Otis','June','Wrangler','Sage','Cooper','Lacey','Murphy','Dottie','Gus','Ivy'];
    const BREEDS = ['Quarter Horse','Thoroughbred','Paint','Warmblood','Appaloosa','Arabian','Morgan','Mustang'];
    const COATS  = ['Bay','Chestnut','Palomino','Grey','Sorrel','Buckskin','Black','Paint'];
    const SEXES  = ['mare','gelding','stallion'];
    const FIRST  = ['Karen','Dennis','Maria','Greg','Nina','Carl','Joy','Hank','Rosa','Pete','Dana','Will','Tess','Omar','Beth','Jed'];
    const LAST   = ['Webb','Pratt','Lopez','Hsu','Patel','Reed','Tran','Boyd','Diaz','Kane','Frost','Mills','Park','Nolan','Shaw','Vega'];
    const STAFF_FIRST = ['Cody','Mara','Leon','Trish','Hector','Bree','Dale','Faye'];

    // round-robin cursors so names/horses don't repeat across tenants
    const ctr = { user:100, horse:100, ration:1000, health:100, event:100, task:100, invoice:100, message:100, hn:0, bn:0, sf:0 };
    const nx  = k => ++ctr[k];
    const pick = (arr, seed) => arr[seed % arr.length];

    cfgs.forEach((c, ci) => {
      S.companies.push({
        id:c.id, name:c.name, slug:c.slug, location:c.location,
        address:`${100 + c.id*7} County Road, ${c.location}`, phone:`(512) 555-0${100 + c.id}`,
        website:`www.${c.domain}`, plan:c.plan, facilityType:"Boarding facility",
        status:c.status, joined:c.joined, ownerEmail:c.ownerEmail
      });

      const initials = n => n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      // Owner
      const ownerId = nx('user');
      S.users.push({ id:ownerId, companyId:c.id, name:c.ownerName, email:c.ownerEmail, password:"StableOS123", role:"owner", avatar:initials(c.ownerName) });
      // Manager
      const mgrName = `${pick(STAFF_FIRST, ctr.sf++)} ${pick(LAST, c.id*3)}`;
      const mgrId = nx('user');
      S.users.push({ id:mgrId, companyId:c.id, name:mgrName, email:`manager@${c.domain}`, password:"stable123", role:"manager", avatar:initials(mgrName) });
      const staffIds = [mgrId];
      // Enterprise gets an extra trainer
      if (c.plan === 'Enterprise') {
        const trName = `${pick(STAFF_FIRST, ctr.sf++)} ${pick(LAST, c.id*5)}`;
        const trId = nx('user');
        S.users.push({ id:trId, companyId:c.id, name:trName, email:`trainer@${c.domain}`, password:"stable123", role:"trainer", avatar:initials(trName) });
        staffIds.push(trId);
      }
      // Boarders
      const boarderCount = c.plan === 'Enterprise' ? 3 : 2;
      const boarderIds = [];
      for (let b = 0; b < boarderCount; b++) {
        const bn = `${pick(FIRST, ctr.bn)} ${pick(LAST, ctr.bn + 7)}`; ctr.bn++;
        const bid = nx('user');
        S.users.push({ id:bid, companyId:c.id, name:bn, email:`${bn.split(' ')[0].toLowerCase()}${bid}@gmail.com`, password:"stable123", role:"boarder", avatar:initials(bn) });
        boarderIds.push(bid);
      }
      // Horses
      const horseCount = c.plan === 'Enterprise' ? 8 : c.plan === 'Professional' ? 6 : 4;
      const horseIds = [];
      for (let h = 0; h < horseCount; h++) {
        const hid = nx('horse');
        const owned = h < boarderIds.length;            // first horses belong to boarders
        S.horses.push({
          id:hid, companyId:c.id, name:pick(HNAMES, ctr.hn++), breed:pick(BREEDS, hid),
          coat:pick(COATS, hid+ci), sex:pick(SEXES, hid),
          location: owned ? `Paddock ${h+1}` : `Stall ${h+1}`, boardType: owned ? 'paddock' : 'stall',
          ownerId: owned ? boarderIds[h] : null, status:"active", notes:""
        });
        horseIds.push(hid);
        S.feedRations.push(
          { id:nx('ration'), companyId:c.id, horseId:hid, meal:"am", ration:"1 scoop pellets + 1 flake bermuda", notes:"" },
          { id:nx('ration'), companyId:c.id, horseId:hid, meal:"pm", ration:"2 flake bermuda", notes:"" }
        );
      }
      // Health — one due-soon item to populate alerts, one resolved vet note
      const soon = new Date(); soon.setDate(soon.getDate() + 12 + ci*3);
      S.healthRecords.push(
        { id:nx('health'), companyId:c.id, horseId:horseIds[0], type:"vaccination", title:"5-way + WNV", performedOn:"2025-06-15", nextDueOn:soon.toISOString().split('T')[0], provider:"Dr. Reyes", cost:85, notes:"" },
        { id:nx('health'), companyId:c.id, horseId:horseIds[1], type:"farrier", title:"Trim & shoe", performedOn:"2026-05-22", nextDueOn:"2026-07-22", provider:"M. Cole", cost:120, notes:"" }
      );
      // Events today
      S.events.push(
        { id:nx('event'), companyId:c.id, title:`Lesson — ${S.horses.find(x=>x.id===horseIds[0]).name}`, type:"lesson", arena:c.arenas[0], horseId:horseIds[0], staffId:mgrId, startsAt:`${TODAY}T09:00:00`, endsAt:`${TODAY}T10:00:00`, notes:"" },
        { id:nx('event'), companyId:c.id, title:`Training — ${S.horses.find(x=>x.id===horseIds[1]).name}`, type:"training", arena:c.arenas[0], horseId:horseIds[1], staffId:mgrId, startsAt:`${TODAY}T13:00:00`, endsAt:`${TODAY}T14:00:00`, notes:"" }
      );
      // Tasks
      S.tasks.push(
        { id:nx('task'), companyId:c.id, title:"Muck stalls & turn out", assigneeId:mgrId, dueOn:TODAY, priority:"normal", done:false, doneAt:null },
        { id:nx('task'), companyId:c.id, title:"Top off water troughs", assigneeId:mgrId, dueOn:TODAY, priority:"high", done:false, doneAt:null }
      );
      // Invoices — one paid, one outstanding (overdue for suspended company)
      const base = PLAN_MRR[c.plan] >= 399 ? 800 : PLAN_MRR[c.plan] >= 199 ? 600 : 450;
      S.invoices.push(
        { id:nx('invoice'), companyId:c.id, boarderId:boarderIds[0], horseId:horseIds[0], number:`INV-2026-${String(100+c.id*2)}`, period:"2026-06", amount:base, status:"paid", dueOn:"2026-06-01", paidOn:"2026-06-02", lines:[{description:"Full board (Jun)", qty:1, unitPrice:base}] },
        { id:nx('invoice'), companyId:c.id, boarderId:boarderIds[1]||boarderIds[0], horseId:horseIds[1], number:`INV-2026-${String(101+c.id*2)}`, period:"2026-06", amount:base, status:c.status==='suspended'?'overdue':'sent', dueOn:c.status==='suspended'?"2026-05-15":"2026-06-15", paidOn:null, lines:[{description:"Full board (Jun)", qty:1, unitPrice:base}] }
      );
      // Welcome message
      S.messages.push({ id:nx('message'), companyId:c.id, senderId:ownerId, recipientId:null, body:`Welcome to ${c.name} on StableOS! Reach out here with any questions.`, readAt:null, createdAt:"2026-06-10T09:00:00" });
    });

    return S;
  }

  // ── Store plumbing ──────────────────────────────────────────────────────
  const nid = arr => arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
  let data, auth, padmin;

  function load() {
    try { data = JSON.parse(localStorage.getItem(STORE) || 'null') || buildSeed(); } catch (e) { data = buildSeed(); }
    try { auth = JSON.parse(localStorage.getItem(AUTH) || 'null'); } catch (e) { auth = null; }
    try { padmin = JSON.parse(localStorage.getItem(PADMIN) || 'null'); } catch (e) { padmin = null; }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) {} }
  load();

  // Tenant guard: every read is scoped to the signed-in user's companyId.
  const cid = () => auth && auth.companyId;
  const co  = arr => arr.filter(r => r.companyId === cid());
  const monthYear = d => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const slugify = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function sessionFor(u) {
    const c = data.companies.find(x => x.id === u.companyId);
    return { userId:u.id, companyId:u.companyId, name:u.name, email:u.email, role:u.role,
             avatar:u.avatar || u.name.slice(0,2).toUpperCase(), barnName: c ? c.name : 'StableOS' };
  }

  window.DB = {
    // ── Tenant auth ──
    getAuth: () => auth,
    login(email, pw) {
      const u = data.users.find(u => u.email === email && u.password === pw);
      if (!u) return null;
      const c = data.companies.find(x => x.id === u.companyId);
      if (c && c.status === 'suspended') return { error: 'suspended', barnName: c.name };
      auth = sessionFor(u);
      localStorage.setItem(AUTH, JSON.stringify(auth));
      return auth;
    },
    logout() { auth = null; localStorage.removeItem(AUTH); },

    // ── Sign up a brand-new tenant (onboarding) ──
    // Creates the company + owner user in one step, then signs the owner in.
    signup(form) {
      const now = new Date();
      const company = {
        id: nid(data.companies),
        name: form.barnName || 'New Stable',
        slug: slugify(form.barnName) || ('stable-' + Date.now()),
        location: (form.address && form.address.includes(',')) ? form.address.split(',').slice(1).join(',').trim() : (form.address || '—'),
        address: form.address || '',
        phone: form.phone || '',
        website: '',
        plan: form.plan || 'Professional',
        facilityType: form.facilityType || 'Boarding facility',
        status: 'trial',
        joined: monthYear(now),
        ownerEmail: form.email
      };
      data.companies.push(company);
      const ownerName = form.ownerName || (form.email ? form.email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g, m=>m.toUpperCase()) : 'Owner');
      const owner = { id: nid(data.users), companyId: company.id, name: ownerName, email: form.email, password: form.password || 'StableOS123', role: 'owner', avatar: ownerName.slice(0,2).toUpperCase() };
      data.users.push(owner);
      // Optional first staff invite from the onboarding wizard
      if (form.staffName && form.staffEmail) {
        const roleMap = { 'Stable Owner':'owner','Manager':'manager','Staff / Groom':'staff','Trainer':'trainer','Boarder / Client':'boarder' };
        data.users.push({ id: nid(data.users), companyId: company.id, name: form.staffName, email: form.staffEmail, password: 'stable123', role: roleMap[form.staffRole] || 'staff', avatar: form.staffName.slice(0,2).toUpperCase() });
      }
      save();
      auth = sessionFor(owner);
      localStorage.setItem(AUTH, JSON.stringify(auth));
      return { token: 'demo-' + company.id, company, user: { id: owner.id, email: owner.email, role: owner.role } };
    },

    // ── Company (current tenant) ──
    getBarn() { const c = data.companies.find(x => x.id === cid()); return c ? { ...c } : {}; },
    updateBarn(d) { const i = data.companies.findIndex(x => x.id === cid()); if (i < 0) return; Object.assign(data.companies[i], d); save(); return { ...data.companies[i] }; },

    // ── Horses ──
    getHorses(f = {}) { let h = co(data.horses); if (f.status) h = h.filter(x => x.status === f.status); if (f.ownerId !== undefined) h = h.filter(x => x.ownerId === f.ownerId); return h.map(x => ({ ...x })); },
    getHorseById(id) { const h = data.horses.find(x => x.id === id && x.companyId === cid()); return h ? { ...h } : null; },
    addHorse(d) { const h = { id: nid(data.horses), companyId: cid(), status: 'active', ...d }; data.horses.push(h); save(); return h; },
    updateHorse(id, d) { const i = data.horses.findIndex(h => h.id === id && h.companyId === cid()); if (i < 0) return; Object.assign(data.horses[i], d); save(); return { ...data.horses[i] }; },

    // ── Feeding ──
    getFeedRations(hid) { return co(data.feedRations).filter(r => !hid || r.horseId === hid).map(r => ({ ...r })); },
    setFeedRation(hid, meal, ration, notes = '') { const i = data.feedRations.findIndex(r => r.horseId === hid && r.meal === meal && r.companyId === cid()); if (i < 0) data.feedRations.push({ id: nid(data.feedRations), companyId: cid(), horseId: hid, meal, ration, notes }); else Object.assign(data.feedRations[i], { ration, notes }); save(); },
    getFeedLog(date) { return co(data.feedLog).filter(l => l.date === date).map(l => ({ ...l })); },
    isFed(hid, meal, date) { return data.feedLog.some(l => l.horseId === hid && l.meal === meal && l.date === date && l.companyId === cid()); },
    toggleFeedLog(hid, meal, date, uid) { const i = data.feedLog.findIndex(l => l.horseId === hid && l.meal === meal && l.date === date && l.companyId === cid()); if (i < 0) data.feedLog.push({ id: nid(data.feedLog), companyId: cid(), horseId: hid, meal, date, fedBy: uid, fedAt: new Date().toISOString() }); else data.feedLog.splice(i, 1); save(); },

    // ── Health ──
    getHealthRecords(hid) { let r = co(data.healthRecords); if (hid) r = r.filter(x => x.horseId === hid); return r.map(x => ({ ...x })).sort((a, b) => (b.performedOn || '').localeCompare(a.performedOn || '')); },
    addHealthRecord(d) { const r = { id: nid(data.healthRecords), companyId: cid(), ...d }; data.healthRecords.push(r); save(); return r; },
    deleteHealthRecord(id) { data.healthRecords = data.healthRecords.filter(r => !(r.id === id && r.companyId === cid())); save(); },
    updateHealthRecord(id, d) { const i = data.healthRecords.findIndex(r => r.id === id && r.companyId === cid()); if (i < 0) return; Object.assign(data.healthRecords[i], d); save(); return { ...data.healthRecords[i] }; },
    getDueRecords() { const now = Date.now(); return co(data.healthRecords).filter(r => r.nextDueOn).map(r => ({ ...r, _days: Math.ceil((new Date(r.nextDueOn) - now) / 86400000) })).filter(r => r._days <= 45).sort((a, b) => a._days - b._days); },

    // ── Events ──
    getEvents(from, to) { let e = co(data.events); if (from) e = e.filter(x => x.startsAt >= from); if (to) e = e.filter(x => x.startsAt <= to); return e.map(x => ({ ...x })).sort((a, b) => a.startsAt.localeCompare(b.startsAt)); },
    addEvent(d) { const e = { id: nid(data.events), companyId: cid(), ...d }; data.events.push(e); save(); return e; },
    deleteEvent(id) { data.events = data.events.filter(e => !(e.id === id && e.companyId === cid())); save(); },
    updateEvent(id, d) { const i = data.events.findIndex(e => e.id === id && e.companyId === cid()); if (i < 0) return; Object.assign(data.events[i], d); save(); return { ...data.events[i] }; },

    // ── Tasks ──
    getTasks(f = {}) { let t = co(data.tasks); if (f.done !== undefined) t = t.filter(x => x.done === f.done); if (f.assigneeId) t = t.filter(x => x.assigneeId === f.assigneeId); const p = { high:0, normal:1, low:2 }; return t.map(x => ({ ...x })).sort((a, b) => a.done !== b.done ? (a.done ? 1 : -1) : (p[a.priority] || 1) - (p[b.priority] || 1)); },
    addTask(d) { const t = { id: nid(data.tasks), companyId: cid(), done: false, doneAt: null, ...d }; data.tasks.push(t); save(); return t; },
    toggleTask(id) { const i = data.tasks.findIndex(t => t.id === id && t.companyId === cid()); if (i < 0) return; data.tasks[i].done = !data.tasks[i].done; data.tasks[i].doneAt = data.tasks[i].done ? new Date().toISOString() : null; save(); return { ...data.tasks[i] }; },
    deleteTask(id) { data.tasks = data.tasks.filter(t => !(t.id === id && t.companyId === cid())); save(); },
    updateTask(id, d) { const i = data.tasks.findIndex(t => t.id === id && t.companyId === cid()); if (i < 0) return; Object.assign(data.tasks[i], d); save(); return { ...data.tasks[i] }; },

    // ── Invoices ──
    getInvoices(f = {}) { let inv = co(data.invoices); if (f.boarderId) inv = inv.filter(x => x.boarderId === f.boarderId); if (f.status) inv = inv.filter(x => x.status === f.status); return inv.map(x => ({ ...x })).sort((a, b) => b.number.localeCompare(a.number)); },
    addInvoice(d) { const id = nid(data.invoices); const inv = { id, companyId: cid(), number: `INV-2026-${String(id).padStart(3, '0')}`, status: 'sent', ...d }; data.invoices.push(inv); save(); return inv; },
    updateInvoice(id, d) { const i = data.invoices.findIndex(x => x.id === id && x.companyId === cid()); if (i < 0) return; Object.assign(data.invoices[i], d); save(); return { ...data.invoices[i] }; },
    markInvoicePaid(id) { this.updateInvoice(id, { status: 'paid', paidOn: new Date().toISOString().split('T')[0] }); },

    // ── Messages ──
    getMessages() { return co(data.messages).map(x => ({ ...x })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
    sendMessage(d) { const m = { id: nid(data.messages), companyId: cid(), readAt: null, createdAt: new Date().toISOString(), ...d }; data.messages.push(m); save(); return m; },
    markRead(id) { const i = data.messages.findIndex(m => m.id === id && m.companyId === cid()); if (i >= 0) { data.messages[i].readAt = new Date().toISOString(); save(); } },
    unreadCount() { return co(data.messages).filter(m => !m.readAt).length; },

    // ── Users (current tenant) ──
    getUsers() { return co(data.users).map(u => ({ ...u, password: undefined })); },
    getUserById(id) { const u = data.users.find(x => x.id === id && x.companyId === cid()); return u ? { ...u, password: undefined } : null; },
    getBoarders() { return co(data.users).filter(u => u.role === 'boarder').map(u => ({ ...u, password: undefined })); },
    getStaff() { return co(data.users).filter(u => u.role !== 'boarder').map(u => ({ ...u, password: undefined })); },
    addUser(d) { const u = { id: nid(data.users), companyId: cid(), avatar: d.name.slice(0, 2).toUpperCase(), ...d }; data.users.push(u); save(); return { ...u, password: undefined }; },
    updateUser(id, d) {
      const i = data.users.findIndex(u => u.id === id && u.companyId === cid());
      if (i < 0) return;
      const fields = {};
      ['name', 'email', 'phone', 'role'].forEach(k => { if (d[k] !== undefined) fields[k] = d[k]; });
      Object.assign(data.users[i], fields);
      if (d.name) data.users[i].avatar = d.name.slice(0, 2).toUpperCase();
      save();
      return { ...data.users[i], password: undefined };
    },

    // ════ Platform admin (super admin) — NOT scoped to any company ════
    getPlatformAuth: () => padmin,
    platformLogin(email, pw) {
      const a = data.platformAdmins.find(x => x.email === email && x.password === pw);
      if (!a) return null;
      padmin = { id: a.id, name: a.name, email: a.email };
      localStorage.setItem(PADMIN, JSON.stringify(padmin));
      return padmin;
    },
    platformLogout() { padmin = null; localStorage.removeItem(PADMIN); },
    PLAN_MRR,

    _companyStats(c) {
      const horses = data.horses.filter(h => h.companyId === c.id && h.status === 'active').length;
      const users  = data.users.filter(u => u.companyId === c.id).length;
      const owner  = data.users.find(u => u.companyId === c.id && u.role === 'owner');
      return {
        id: c.id, name: c.name, slug: c.slug, loc: c.location, plan: c.plan,
        horses, users, status: c.status, joined: c.joined,
        owner: owner ? owner.name : '—', ownerEmail: c.ownerEmail
      };
    },
    adminGetCompanies() { return data.companies.map(c => this._companyStats(c)); },
    adminStats() {
      const cs = data.companies;
      const active = cs.filter(c => c.status === 'active');
      return {
        mrr: active.reduce((s, c) => s + (PLAN_MRR[c.plan] || 0), 0),
        active: active.length,
        trial: cs.filter(c => c.status === 'trial').length,
        suspended: cs.filter(c => c.status === 'suspended').length,
        horses: data.horses.filter(h => h.status === 'active').length,
        total: cs.length
      };
    },
    adminAddCompany(form) {
      const company = {
        id: nid(data.companies), name: form.name, slug: slugify(form.name) || ('co-' + Date.now()),
        location: form.loc || '—', address: '', phone: '', website: '',
        plan: form.plan || 'Professional', facilityType: form.facilityType || 'Boarding facility',
        status: 'trial', joined: monthYear(new Date()), ownerEmail: form.email
      };
      data.companies.push(company);
      const name = form.owner || form.email.split('@')[0];
      data.users.push({ id: nid(data.users), companyId: company.id, name, email: form.email, password: 'StableOS123', role: 'owner', avatar: name.slice(0, 2).toUpperCase() });
      save();
      return this._companyStats(company);
    },
    adminChangePlan(companyId, plan) { const c = data.companies.find(x => x.id === companyId); if (c) { c.plan = plan; save(); } return c ? this._companyStats(c) : null; },
    adminSetStatus(companyId, status) { const c = data.companies.find(x => x.id === companyId); if (c) { c.status = status; save(); } return c ? this._companyStats(c) : null; },
    // Impersonate: open a tenant session as that company's owner (used by super admin).
    adminImpersonate(companyId) {
      const owner = data.users.find(u => u.companyId === companyId && u.role === 'owner') || data.users.find(u => u.companyId === companyId);
      if (!owner) return null;
      auth = sessionFor(owner);
      localStorage.setItem(AUTH, JSON.stringify(auth));
      return auth;
    },

    reset() {
      data = buildSeed(); save();
      auth = null; localStorage.removeItem(AUTH);
      padmin = null; localStorage.removeItem(PADMIN);
    }
  };
})();
