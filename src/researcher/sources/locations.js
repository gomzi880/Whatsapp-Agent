/**
 * Global Target Locations & Gym Categories
 */

export const TARGET_LOCATIONS = {
  India: {
    'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Ratlam', 'Rewa'],
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane', 'Aurangabad', 'Navi Mumbai', 'Solapur'],
    'Delhi': ['New Delhi', 'South Delhi', 'North Delhi', 'West Delhi', 'Dwarka', 'Rohini', 'Connaught Place'],
    'Uttar Pradesh': ['Noida', 'Lucknow', 'Kanpur', 'Ghaziabad', 'Varanasi', 'Agra', 'Meerut', 'Prayagraj'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Gandhinagar', 'Jamnagar'],
    'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Alwar'],
    'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Davangere'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli'],
    'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Secunderabad'],
    'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Kharagpur'],
    'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Mohali', 'Bathinda'],
    'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar', 'Sonipat'],
    'Kerala': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Alappuzha'],
    'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati'],
    'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia'],
    'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri', 'Sambalpur'],
    'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon'],
    'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh'],
    'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Kullu'],
    'Jammu & Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'],
    'Chandigarh': ['Chandigarh']
  },
  'USA': {
    'New York': ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse'],
    'California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento'],
    'Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth'],
    'Florida': ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'],
    'Illinois': ['Chicago', 'Aurora', 'Naperville', 'Rockford'],
    'Washington': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'],
    'Massachusetts': ['Boston', 'Worcester', 'Cambridge', 'Lowell']
  },
  'UK': {
    'England': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Bristol', 'Newcastle', 'Sheffield'],
    'Scotland': ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee'],
    'Wales': ['Cardiff', 'Swansea', 'Newport'],
    'Northern Ireland': ['Belfast', 'Derry']
  },
  'Canada': {
    'Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton'],
    'British Columbia': ['Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Victoria'],
    'Quebec': ['Montreal', 'Quebec City', 'Laval', 'Gatineau'],
    'Alberta': ['Calgary', 'Edmonton', 'Red Deer']
  },
  'Australia': {
    'New South Wales': ['Sydney', 'Newcastle', 'Wollongong'],
    'Victoria': ['Melbourne', 'Geelong', 'Ballarat'],
    'Queensland': ['Brisbane', 'Gold Coast', 'Sunshine Coast'],
    'Western Australia': ['Perth', 'Fremantle'],
    'South Australia': ['Adelaide']
  },
  'UAE': {
    'Dubai': ['Dubai', 'Downtown Dubai', 'Marina', 'Jumeirah', 'Deira', 'Al Barsha'],
    'Abu Dhabi': ['Abu Dhabi', 'Al Ain'],
    'Sharjah': ['Sharjah'],
    'Ajman': ['Ajman'],
    'Ras Al Khaimah': ['Ras Al Khaimah']
  },
  'Singapore': {
    'Central': ['Singapore', 'Orchard', 'Marina Bay', 'Tampines', 'Jurong']
  },
  'Germany': {
    'Berlin': ['Berlin'],
    'Bavaria': ['Munich', 'Nuremberg', 'Augsburg'],
    'Hamburg': ['Hamburg'],
    'Hesse': ['Frankfurt', 'Wiesbaden', 'Kassel'],
    'North Rhine-Westphalia': ['Cologne', 'Dusseldorf', 'Dortmund', 'Essen']
  },
  'France': {
    'Ile-de-France': ['Paris', 'Boulogne-Billancourt', 'Saint-Denis'],
    'Auvergne-Rhone-Alpes': ['Lyon', 'Grenoble', 'Saint-Etienne'],
    'Provence-Alpes-Cote d Azur': ['Marseille', 'Nice', 'Toulon']
  },
  'Netherlands': {
    'North Holland': ['Amsterdam', 'Haarlem'],
    'South Holland': ['Rotterdam', 'The Hague', 'Leiden'],
    'Utrecht': ['Utrecht', 'Amersfoort'],
    'North Brabant': ['Eindhoven', 'Tilburg', 'Breda']
  }
};

export const GYM_CATEGORIES = [
  'Fitness Centre',
  'Commercial Gym',
  'Independent Gym',
  'Gym Chain',
  'CrossFit Studio',
  'Personal Training Studio',
  'Premium Fitness Club',
  'Boutique Fitness Studio',
  'Women Fitness Centre',
  'Strength & Conditioning'
];
