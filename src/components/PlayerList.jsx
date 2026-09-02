import { useState } from 'react'

export default function PlayerList({
  playerList, playerInfo, currentDrawer, correctGuessers, underdogs,
  currentRound, maxRounds, isPrivate, roomId,
  setShowPlayerModal, setShowSettingsModal
}) {
  // We moved this state out of GameRoom because only the PlayerList uses it!
  const [inviteCopied, setInviteCopied] = useState(false)

  return (
    <div className="sidebar-left">
      <div 
        onClick={() => setShowPlayerModal(true)}
        title="Click to manage lobby players"
        style={{ backgroundColor: 'var(--bg-panel)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-main)', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s ease', WebkitTapHighlightColor: 'transparent' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '1px solid var(--border-main)', paddingBottom: '12px', position: 'relative', transition: 'border-color 0.3s ease' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', marginBottom: '6px' }}>
            <h3 style={{ margin: 0, color: '#bb86fc', fontSize: '16px', letterSpacing: '1px' }}>SCORES</h3>
            
            <button 
              onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); }}
              title="Game Settings"
              style={{ position: 'absolute', right: '0', background: 'var(--bg-player)', border: '1px solid var(--border-main)', color: 'var(--text-main)', padding: '4px 10px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', transition: 'all 0.3s ease' }}
            >
              ⚙️
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', backgroundColor: 'var(--border-main)', padding: '3px 8px', borderRadius: '12px', transition: 'all 0.3s ease', whiteSpace: 'nowrap' }}>
              ROUND {currentRound}/{maxRounds}
            </span>
            {isPrivate && (
              <button onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(`${window.location.origin}/?room=${roomId}`);
                setInviteCopied(true);
                setTimeout(() => setInviteCopied(false), 5000);
              }} style={{ background: inviteCopied ? '#4caf50' : 'var(--border-main)', color: inviteCopied ? '#fff' : '#4caf50', border: '1px solid #4caf50', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease', whiteSpace: 'nowrap' }}>
                {inviteCopied ? '✔️ COPIED' : '+ INVITE'}
              </button>
            )}
          </div>
        </div>
        
        <ul style={{ listStyle: 'none', padding: '0 5px', margin: 0, overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {playerList.map((p, index) => {
            const isMe = p.name === playerInfo.playerName;
            const isDrawer = p.name === currentDrawer;
            const hasGuessed = correctGuessers.includes(p.name);
            const isUnderdog = underdogs.includes(p.id) && !isDrawer;
            
            return (
              <li 
                key={index}
                className={isUnderdog ? "underdog-glow" : ""} 
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '10px 14px', borderRadius: '12px',
                  backgroundColor: hasGuessed ? 'rgba(3, 218, 198, 0.15)' : (isMe ? 'rgba(187, 134, 252, 0.15)' : 'var(--bg-player)'),
                  border: isUnderdog ? '2px solid transparent' : (hasGuessed ? '1px solid #03dac6' : (isMe ? '1px solid #bb86fc' : '1px solid transparent')),
                  transition: 'all 0.3s ease', boxShadow: isUnderdog ? 'none' : '0 4px 6px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: hasGuessed ? '#03dac6' : (isUnderdog ? '#ff9800' : 'var(--border-main)'), color: hasGuessed || isUnderdog ? '#000' : 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', flexShrink: 0, transition: 'all 0.3s ease' }}>
                    {isUnderdog ? '🔥' : (index + 1)}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: hasGuessed ? '#03dac6' : (isUnderdog ? '#ff9800' : (isMe ? '#bb86fc' : 'var(--text-main)')), whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', transition: 'color 0.3s ease' }}>
                      {p.name} {isMe && '(You)'}
                    </span>
                    <span style={{ fontSize: '11px', color: p.isOffline ? '#f44336' : (isUnderdog ? '#ff9800' : 'var(--text-muted)'), marginTop: '2px', transition: 'color 0.3s ease' }}>
                      {p.isOffline ? '💤 Offline...' : (hasGuessed ? '✔️ Guessed correctly!' : (isDrawer ? '✏️ Drawing...' : (isUnderdog ? '🔥 Underdog Buff!' : 'Guesser')))}
                    </span>
                  </div>
                </div>
                
                <span style={{ fontSize: '16px', fontWeight: '900', color: hasGuessed ? '#03dac6' : (isUnderdog ? '#ff9800' : 'var(--text-main)'), flexShrink: 0, transition: 'color 0.3s ease' }}>
                  {p.score}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  )
}