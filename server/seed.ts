import bcrypt from 'bcryptjs';
import { pool, transaction } from './db';
import { migrate } from './migrate';
const rice='https://images.unsplash.com/photo-1743674453123-93356ade2891?auto=format&fit=crop&w=1000&q=85';
const curry='https://images.unsplash.com/photo-1711633648895-f5df0336ff55?auto=format&fit=crop&w=1000&q=85';
const interior='https://images.pexels.com/photos/5607958/pexels-photo-5607958.jpeg?auto=compress&cs=tinysrgb&w=1000';
export async function seed(password: string) {
  if(password.length<12 || Buffer.byteLength(password,'utf8')>72) throw new Error('Set SEED_PASSWORD to a private password of 12–72 ASCII characters.');
  await migrate();const passwordHash=await bcrypt.hash(password,12);
  await transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(472104)');
    if((await c.query('SELECT 1 FROM restaurants LIMIT 1')).rowCount) { console.log('Sample data already exists; no data changed.');return; }
    const people=[['Portal Admin','admin@lankatable.test','admin'],['Review Moderator','moderator@lankatable.test','moderator'],['Restaurant Partner','owner@lankatable.test','owner'],['Nethmi Perera','customer@lankatable.test','customer'],['Arun Selvan','arun@lankatable.test','customer'],['Maya Fernando','maya@lankatable.test','customer']];
    const users:number[]=[];
    for(const [name,email,role] of people) users.push((await c.query('INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$3,$4) RETURNING id',[name,email,role,passwordHash])).rows[0].id);
    const categories=['Rice & curry','Kottu & hoppers','Short eats','Jaffna cuisine','Seafood','Chinese','Indian','Western'];
    const categoryIds:number[]=[];
    for(const name of categories) categoryIds.push((await c.query('INSERT INTO categories(name,slug) VALUES($1,$2) RETURNING id',[name,name.toLowerCase().replace(/ & /g,'-').replace(/ /g,'-')])).rows[0].id);
    const venues=[
      ['The Cinnamon Courtyard','Colombo','24 Garden Lane, Colombo 07','A leafy courtyard for slow lunches, fragrant curries, and conversations that last a little longer.',interior],
      ['Kandy Clay Pot','Kandy','18 Lake View Road, Kandy','Comforting hill-country cooking, seasonal vegetables, and family recipes served straight from the clay pot.',rice],
      ['Salt & Sea Kitchen','Galle','36 Lighthouse Lane, Galle Fort','Coastal flavours, rich seafood curries, and an easy-going table in the heart of the fort.',curry],
      ['Palmyrah Table','Colombo','12 Palm Avenue, Colombo 06','Northern flavours with a generous spirit: Jaffna curries, fragrant spices, and dishes made for sharing.',rice],
      ['Lakehouse Wok','Kandy','42 Lakeside Avenue, Kandy','A neighbourhood kitchen serving wok favourites alongside Sri Lankan classics.',interior],
      ['Fort Street Social','Galle','8 Church Lane, Galle Fort','A relaxed meeting place for short eats, fresh vegetarian plates, and familiar Western favourites.',interior]
    ];
    // Deliberately fictional establishments and illustrative prices; no commercial claims.
    const restaurantIds:number[]=[];
    for(const [name,city,address,description,image] of venues) restaurantIds.push((await c.query('INSERT INTO restaurants(name,city,address,description,image_url,owner_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[name,city,address,description,image,users[2]])).rows[0].id);
    const meals:[number,number,string,string,string,number,boolean,boolean,boolean,number,string][]=[
      [0,0,'Village rice & curry','බත් සහ ව්‍යංජන','சோறும் கறியும்',1450,true,true,false,2,rice],
      [0,1,'Egg hopper breakfast','බිත්තර ආප්ප','முட்டை அப்பம்',950,true,false,false,1,rice],
      [0,1,'Chicken kottu','චිකන් කොත්තු','கோழி கொத்து',1850,false,false,true,2,curry],
      [1,0,'Garden rice & curry','එළවළු බත්','காய்கறி சோறு',750,true,true,false,1,rice],
      [1,2,'Vegetable roti','එළවළු රොටී','காய்கறி ரொட்டி',280,true,true,false,1,curry],
      [1,1,'String hoppers & dhal','ඉඳි ආප්ප','இடியப்பம்',650,true,true,false,0,rice],
      [2,4,'Southern fish curry','මාළු කරිය','மீன் கறி',2850,false,false,true,3,curry],
      [2,4,'Pepper prawns','ඉස්සන්','இறால்',3800,false,false,false,2,curry],
      [2,0,'Coastal rice & curry','බත් සහ මාළු','மீன் சோறு',2400,false,false,true,2,rice],
      [3,3,'Jaffna crab curry','යාපනය කකුළු කරිය','யாழ்ப்பாண நண்டு கறி',4200,false,false,false,3,curry],
      [3,3,'Vegetable thali','එළවළු තාලි','சைவ தாளி',1400,true,true,false,2,rice],
      [3,6,'Masala dosa','මසාලා තෝසේ','மசாலா தோசை',900,true,true,false,1,rice],
      [4,5,'Vegetable fried rice','එළවළු ෆ්‍රයිඩ් රයිස්','காய்கறி வறுத்த சோறு',1150,true,true,false,0,rice],
      [4,5,'Hot butter cuttlefish','දැල්ලන්','கணவாய்',2200,false,false,false,2,curry],
      [4,6,'Chicken biryani','චිකන් බිරියානි','கோழி பிரியாணி',1750,false,false,true,2,rice],
      [5,7,'Roasted vegetable bowl','එළවළු බඳුන','வறுத்த காய்கறி கிண்ணம்',1800,true,true,false,0,rice],
      [5,2,'Fish cutlets','මාළු කට්ලට්','மீன் கட்லெட்',450,false,false,false,1,curry],
      [5,7,'Creamy mushroom pasta','බිම්මල් පැස්ටා','காளான் பாஸ்தா',2100,true,false,false,0,curry]
    ];
    const menuIds:number[]=[];
    for(const [r,cat,name,si,ta,price,vegetarian,vegan,halal,spice,image] of meals) menuIds.push((await c.query('INSERT INTO menu_items(restaurant_id,category_id,name,name_si,name_ta,description,price,vegetarian,vegan,halal,spice,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id',[restaurantIds[r],categoryIds[cat],name,si,ta,`A kitchen favourite, freshly prepared and served with seasonal accompaniments.`,price,vegetarian,vegan,halal,spice,image])).rows[0].id);
    const bodies=['Beautifully balanced flavours and generous portions. The staff made us feel welcome from the moment we arrived.','ආහාර ඉතා රසවත්. සේවාවත් ඉතා හොඳයි. නැවත එන්න බලාපොරොත්තු වෙනවා.','உணவு மிகவும் சுவையாக இருந்தது. அன்பான சேவை. மீண்டும் வருவோம்.'];
    for(let r=0;r<6;r++)for(let j=0;j<3;j++) {
      const mealIndex=meals.findIndex(m=>m[0]===r)+j;
      await c.query("INSERT INTO postings(author_id,restaurant_id,menu_item_id,kind,body,food,service,value,ambience,status,moderated_by,moderated_at,created_at) VALUES($1,$2,$3,'review',$4,$5,$6,$7,$8,'approved',$9,now(),now()-($10::integer*interval '1 day'))",[users[3+j],restaurantIds[r],menuIds[mealIndex],bodies[j],r===0?5:4+(j%2),j===0?5:4,r===2?4:5,j===2?4:5,users[1],r+j+1]);
    }
    await c.query("INSERT INTO postings(author_id,restaurant_id,kind,body,food,service,value,ambience) VALUES($1,$2,'review',$3,5,4,5,4)",[users[3],restaurantIds[1],'A lovely lunch by the lake. The vegetable curry was my favourite, and the portions were very generous.']);
    console.log('Seeded 6 sample restaurants, 18 dishes, multilingual reviews and a pending review.');
  });
}
if(process.argv[1]?.endsWith('seed.ts')) seed(process.env.SEED_PASSWORD||'').catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
