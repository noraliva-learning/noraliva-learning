
import { useState } from 'react';

export default function Home() {
  const [kid, setKid] = useState(null);

  if (!kid) {
    return (
      <div style={{textAlign:'center', marginTop:80}}>
        <h1>Who is learning today?</h1>
        <button onClick={()=>setKid('liv')} style={{fontSize:24,margin:20}}>🌸 Liv</button>
        <button onClick={()=>setKid('elle')} style={{fontSize:24,margin:20}}>🌼 Elle</button>
      </div>
    )
  }

  return (
    <div style={{textAlign:'center', marginTop:60}}>
      <h2>Welcome {kid === 'liv' ? 'Liv' : 'Elle'}!</h2>
      <p>Select a learning domain:</p>
      {['Math','Reading','Writing','Architecture','Spanish'].map(d=>(
        <div key={d} style={{margin:10}}>
          <button style={{fontSize:20}}>{d}</button>
        </div>
      ))}
    </div>
  );
}
