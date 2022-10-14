const array = [
  [0, 1, 'yanlon', 'yanlon', 'yan lon', null, 33],
  [1, 2, 'soapwa', 'soapwa', 'soap pwa', null, 25],
];

// id, rank, user, instagram, full name, age, weight

[
  'id',
  'rank',
  'full_name',
  'username',
  'instagram',
  'username_color',
  'country',
  'location',
  'fed',
  'date',
  'country',
  'state',
  'meet_code',
  'sex',
  'equip',
  'age',
  'open',
  'body_weight',
  'weight_class',
  'squat',
  'bench',
  'deadlift',
  'total',
  'dots',
];

const a = array.map((ar) => {
  console.log(ar);
  return {
    id: ar[0],
    rank: ar[1],
    user: ar[2],
    instagram: ar[3],
    ['full name']: ar[4],
    age: ar[5],
    weight: ar[6],
  };
});

console.log(a);
