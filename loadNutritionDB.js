const API_KEY = 'AIzaSyDw6XrbIXgpRoGgdM_B6rSMSFLvey8MzBE';
const SHEET_ID = '1or5RHK33L5wDmEgVfFpTElPqJ3vgMvO_e5lxHD6xb0c';
const SHEET_NAME1 = 'Nutrition source'; 
const SHEET_NAME2 = 'Food categories';

const url1 = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME1}?key=${API_KEY}`;

const loadNutritionData = async () => 
{
  try{
    const data = await fetch(url1);
    const response = await data.json();
    const [headers, ...rows] = response.values;
    const formatted = rows.map(row =>
      headers.reduce((obj, key, i) => {
        obj[key] = row[i] || '';
        return obj;
      }, {})
    );

    return formatted; 
  }
  catch (error)
  {
    console.error('Error fetching data:', error);
  }
}


const url2 = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME2}?key=${API_KEY}`;
const foodCategoryData = async () => 
{
  try{
    const data = await fetch(url2);
    const response = await data.json();
    const [headers, ...rows] = response.values;
    const formatted = rows.map(row =>
      headers.reduce((obj, key, i) => {
        obj[key] = row[i] || '';
        return obj;
      }, {})
    );

    return formatted; 
  }
  catch (error)
  {
    console.error('Error fetching data:', error);
  }
}

module.exports = {loadNutritionData, foodCategoryData};














