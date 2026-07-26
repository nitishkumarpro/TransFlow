/* TRANSFLOW — demo data set ALNOOR-01. Every figure on every page reads from here. */
window.TF = window.TF || {};

TF.meta = { v:'v0.3', built:'26 JUL 2026', product:'TRANSFLOW ERP' };

TF.companies = [
  { id:'ALN', name:'Al Noor Transport LLC', trn:'100234567800003' },
  { id:'GSC', name:'Gulf Shipping Co.',     trn:'100987654300003' },
];
TF.company = TF.companies[0];

TF.kpi = { revMTD:448900, costMTD:287600, gpMTD:161300, margin:35.9,
           outstanding:406350, ytdRev:3195200, fleetOut:6, fleetTotal:8 };

TF.months = {
  labels:['FEB','MAR','APR','MAY','JUN','JUL'],
  rev:  [486200,529400,517800,588600,624300,448900],
  cost: [342800,361900,355200,396400,402100,287600],
};

TF.clients = [
  { id:'C01', name:'Gulf Cement Co.',    trn:'100112233400003', terms:30, limit:250000 },
  { id:'C02', name:'Emirates Steel',     trn:'100556677800003', terms:45, limit:400000 },
  { id:'C03', name:'Al Ghurair Foods',   trn:'100998877600003', terms:30, limit:200000 },
  { id:'C04', name:'RAK Ceramics',       trn:'100443322100003', terms:60, limit:300000 },
  { id:'C05', name:'Falcon Pack',        trn:'100667788900003', terms:30, limit:150000 },
  { id:'C06', name:'Emaar Construction', trn:'100223344500003', terms:30, limit:350000 },
  { id:'C07', name:'Masafi Trading',     trn:'10077889900003',  terms:30, limit:100000 },
];

TF.vehicles = [
  { plate:'B-45823', type:'40FT FLATBED',  driver:'Ahmed Khan',    st:'run',  note:'Jebel Ali → Khalifa Port' },
  { plate:'B-78214', type:'40FT FLATBED',  driver:'Bilal Hussain', st:'run',  note:'Hamriyah → Abu Dhabi' },
  { plate:'C-33907', type:'20FT BOX',      driver:'Rajesh Nair',   st:'run',  note:'Al Quoz → Al Ain' },
  { plate:'D-51442', type:'CHILLED VAN',   driver:'Suresh Menon',  st:'run',  note:'Jebel Ali FZ → Sharjah' },
  { plate:'B-90112', type:'LOWBED',        driver:'Imran Baloch',  st:'run',  note:'Jebel Ali → Ras Al Khaimah' },
  { plate:'C-67230', type:'10T TRUCK',     driver:'Yousef Ali',    st:'run',  note:'DIP → Downtown Dubai' },
  { plate:'D-12876', type:'CURTAINSIDER',  driver:'Manoj Kumar',   st:'wrk',  note:'Workshop — brakes' },
  { plate:'B-24501', type:'40FT FLATBED',  driver:'Khalid Rehman', st:'wrk',  note:'RTA reg. renewal' },
];

TF.jobs = [
  { id:'JOB-1052', date:'2026-07-26', client:'Al Ghurair Foods', veh:'C-33907', from:'Al Quoz',        to:'Jebel Ali FZ',     cargo:'Empty Containers', qty:2, rate:450,  st:'wait' },
  { id:'JOB-1051', date:'2026-07-26', client:'Gulf Cement Co.',  veh:'B-45823', from:'Jebel Ali Port', to:'Khalifa Port',     cargo:'2×40ft Containers',qty:2, rate:1850, st:'run'  },
  { id:'JOB-1050', date:'2026-07-26', client:'Emirates Steel',   veh:'B-78214', from:'Hamriyah FZ',    to:'Abu Dhabi',        cargo:'Steel Coils 28T',  qty:1, rate:2400, st:'run'  },
  { id:'JOB-1049', date:'2026-07-25', client:'Al Ghurair Foods', veh:'C-33907', from:'Al Quoz',        to:'Al Ain',           cargo:'Packaged Goods',   qty:1, rate:1150, st:'ok'   },
  { id:'JOB-1048', date:'2026-07-25', client:'Falcon Pack',      veh:'D-51442', from:'Jebel Ali FZ',   to:'Sharjah Airport',  cargo:'Pharma (Chilled)', qty:1, rate:1600, st:'ok'   },
  { id:'JOB-1047', date:'2026-07-25', client:'RAK Ceramics',     veh:'B-90112', from:'Jebel Ali Port', to:'Ras Al Khaimah',   cargo:'Machinery 32T',    qty:1, rate:3200, st:'run'  },
  { id:'JOB-1046', date:'2026-07-24', client:'Emaar Construction',veh:'C-67230',from:'Dubai Inv. Park',to:'Downtown Dubai',   cargo:'Site Materials',   qty:3, rate:650,  st:'ok'   },
  { id:'JOB-1045', date:'2026-07-24', client:'Masafi Trading',   veh:'D-12876', from:'Fujairah Port',  to:'Masafi',           cargo:'Water Pallets',    qty:2, rate:900,  st:'ok'   },
  { id:'JOB-1044', date:'2026-07-23', client:'Gulf Cement Co.',  veh:'B-24501', from:'Jebel Ali Port', to:'Ghayathi',         cargo:'Cement Bags 24T',  qty:1, rate:2750, st:'ok'   },
  { id:'JOB-1043', date:'2026-07-23', client:'Emirates Steel',   veh:'B-45823', from:'Hamriyah FZ',    to:'Mussafah',         cargo:'Rebar Bundles',    qty:2, rate:1300, st:'ok'   },
];

TF.invoices = [
  { no:'INV-2026-0046', client:'Emaar Construction', date:'2026-07-22', due:'2026-07-30', amt:66150,  st:'open'    },
  { no:'INV-2026-0045', client:'RAK Ceramics',       date:'2026-06-05', due:'2026-07-05', amt:97300,  st:'partial' }, /* 40,000 paid */
  { no:'INV-2026-0044', client:'Falcon Pack',        date:'2026-07-14', due:'2026-07-28', amt:41900,  st:'open'    },
  { no:'INV-2026-0043', client:'Al Ghurair Foods',   date:'2026-07-04', due:'2026-07-18', amt:58200,  st:'paid'    },
  { no:'INV-2026-0042', client:'Emirates Steel',     date:'2026-07-02', due:'2026-08-02', amt:124750, st:'open'    },
  { no:'INV-2026-0041', client:'Gulf Cement Co.',    date:'2026-06-12', due:'2026-07-12', amt:86400,  st:'overdue' },
  { no:'INV-2026-0038', client:'Masafi Trading',     date:'2026-05-20', due:'2026-06-20', amt:29850,  st:'overdue' },
];

TF.aging = [
  { label:'0–30 DAYS',  value:232800, color:'var(--teal)'  },
  { label:'31–60 DAYS', value:143700, color:'var(--amber)' },
  { label:'61–90 DAYS', value:29850,  color:'var(--red)'   },
  { label:'90+ DAYS',   value:0,      color:'var(--red)'   },
];

TF.topClients = [
  { label:'Emirates Steel',   value:412300 },
  { label:'Gulf Cement Co.',  value:388450 },
  { label:'RAK Ceramics',     value:296700 },
  { label:'Al Ghurair Foods', value:251200 },
  { label:'Falcon Pack',      value:189600 },
];
