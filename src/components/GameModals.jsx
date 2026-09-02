import { soundManager } from '../audio/soundManager'
export default function GameModals({
  turnSummary, winner, isChoosing, isMyTurn, timeLeft, wordChoices, currentDrawer, socketRef,
  showPlayerModal, setShowPlayerModal, playerList, playerInfo, underdogs,
  showSettingsModal, setShowSettingsModal, isLightMode, setIsLightMode, isPrivate, roomPassword,
  maxPlayers, setMaxPlayers, maxRounds, setMaxRounds, totalDrawTime, setTotalDrawTime, hintLevel, setHintLevel,
  isHost, transferTarget, setTransferTarget
}) {
  return (
    <>
       {turnSummary && !winner && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 999, 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: 'var(--bg-panel)', padding: '30px', borderRadius: '16px', textAlign: 'center', border: '2px solid #03dac6', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', width: '90%', maxWidth: '400px' }}>
              <h2 style={{ color: '#FFD54F', margin: '0 0 10px 0', fontSize: '24px' }}>{turnSummary.reason}</h2>
              <div style={{ color: 'var(--text-muted)', marginBottom: '5px' }}>The word was</div>
              <h1 style={{ color: '#03dac6', margin: '0 0 25px 0', fontSize: '32px', letterSpacing: '2px', textTransform: 'uppercase' }}>{turnSummary.word}</h1>
              
              <div style={{ background: 'var(--bg-player)', borderRadius: '10px', padding: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {turnSummary.scores.map((p, idx) => (
                    <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: idx < turnSummary.scores.length - 1 ? '1px solid var(--border-main)' : 'none', fontWeight: 'bold' }}>
                      <span style={{ color: p.earned > 0 ? '#bb86fc' : 'var(--text-main)' }}>{p.name}</span>
                      <span style={{ color: p.earned > 0 ? '#03dac6' : 'var(--text-muted)' }}>+{p.earned} pts</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {isChoosing && !turnSummary && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            {isMyTurn ? (
              <div style={{ background: '#1e1e1e', padding: '30px', borderRadius: '12px', textAlign: 'center', border: '2px solid #bb86fc', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxWidth: '90%' }}>
                <h2 style={{ color: '#03dac6', marginTop: 0 }}>Choose a word to draw!</h2>
                <h3 style={{ color: '#FFD54F', fontSize: '24px' }}>⏱ {timeLeft}s</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                  {wordChoices.map(w => (
                    <button 
                      key={w}
                      onClick={() => {
                        soundManager.play('select');
                        socketRef.current.emit('word_chosen', w)
                        setIsChoosing(false)
                      }}
                      style={{ padding: '12px 20px', fontSize: '18px', background: '#bb86fc', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: '#bb86fc' }}>{currentDrawer} is picking a word...</h2>
                <h3 style={{ color: '#FFD54F', fontSize: '24px' }}>⏱ {timeLeft}s</h3>
              </div>
            )}
          </div>
        )}

        {showPlayerModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 200,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-main)', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transition: 'all 0.3s ease' }}>
              
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '15px', marginBottom: '15px', transition: 'border-color 0.3s ease' }}>
                <h2 style={{ color: '#bb86fc', margin: 0 }}>Lobby Players</h2>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, maxHeight: '300px', overflowY: 'auto' }}>
                {playerList.map(p => {
                  const isUnderdog = underdogs.includes(p.id) && p.name !== currentDrawer;
                  return (
                  <li key={p.id || p.name} style={{ display: 'flex', flexDirection: 'column', padding: '12px 0', borderBottom: '1px solid var(--border-main)', color: 'var(--text-main)', transition: 'all 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: p.name === playerInfo.playerName ? 'bold' : 'normal', color: p.name === playerInfo.playerName ? '#03dac6' : (isUnderdog ? '#ff9800' : 'var(--text-main)'), transition: 'color 0.3s ease' }}>
                        {isUnderdog ? '🔥 ' : ''}{p.name} {p.name === playerInfo.playerName ? '(You)' : ''} - {p.score} pts
                      </span>
                      {p.name !== playerInfo.playerName && (
                        <button 
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to start a vote to kick ${p.name}?`)) {
                              socketRef.current.emit('initiate_votekick', p.id);
                              setShowPlayerModal(false);
                            }
                          }}
                          style={{ background: '#ff3b30', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          Kick
                        </button>
                      )}
                    </div>
                    {isUnderdog && (
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#ff9800', background: 'rgba(255, 152, 0, 0.15)', padding: '10px', borderRadius: '8px', border: '1px dashed #ff9800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <span style={{ fontSize: '20px' }}>🔥</span> 
                         <span><strong>Late Joiner Buff Active:</strong> This player earns DOUBLE points on every correct guess until they catch up to the top players!</span>
                      </div>
                    )}
                  </li>
                )})}
              </ul>
              
              <button 
                onClick={() => setShowPlayerModal(false)} 
                style={{ width: '100%', padding: '12px', background: 'var(--border-main)', color: 'var(--text-main)', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold', transition: 'all 0.3s ease' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showSettingsModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-main)', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              
              <h2 style={{ color: '#bb86fc', margin: '0 0 20px 0', textAlign: 'center', borderBottom: '1px solid var(--border-main)', paddingBottom: '10px' }}>⚙️ Game Settings</h2>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '10px', background: 'var(--bg-player)', borderRadius: '8px', border: '1px solid var(--border-main)' }}>
                <strong style={{ color: 'var(--text-main)' }}>Theme</strong>
                <button 
                  onClick={() => setIsLightMode(!isLightMode)}
                  style={{ background: 'var(--bg-panel)', color: 'var(--text-main)', border: '1px solid var(--border-main)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {isLightMode ? '🌙 Switch to Dark Mode' : '☀️ Switch to Light Mode'}
                </button>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-player)', borderRadius: '8px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-main)', border: '1px solid var(--border-main)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Room Type:</strong> <span>{isPrivate ? 'Private' : 'Public'}</span></div>
                {isPrivate && <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Password:</strong> <span>{roomPassword || 'None'}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Max Players:</strong> <span>{maxPlayers}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Total Rounds:</strong> <span>{maxRounds}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Draw Time:</strong> <span>{totalDrawTime}s</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Hint Level:</strong> <span>{hintLevel == 1 ? 'Low' : hintLevel == 2 ? 'Normal' : hintLevel == 3 ? 'High' : 'Max'}</span></div>
              </div>

              {isHost && isPrivate && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select 
                      value={transferTarget} 
                      onChange={(e) => setTransferTarget(e.target.value)}
                      style={{ flexGrow: 1, padding: '8px', borderRadius: '6px', background: 'var(--bg-player)', color: 'var(--text-main)', border: '1px solid var(--border-main)', outline: 'none' }}
                    >
                      <option value="">-- Transfer Host To --</option>
                      {playerList.filter(p => p.name !== playerInfo.playerName).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => {
                        if (transferTarget && window.confirm("Are you sure you want to transfer host?")) {
                          socketRef.current.emit('transfer_host', transferTarget);
                          setShowSettingsModal(false);
                        }
                      }}
                      style={{ background: '#03dac6', color: '#000', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Assign
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      if (window.confirm("This will end the current game and return everyone to the waiting lobby canvas to change settings. Are you sure?")) {
                        socketRef.current.emit('restart_lobby');
                        setShowSettingsModal(false);
                      }
                    }}
                    style={{ background: '#ff3b30', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
                  >
                    🔄 Restart Lobby & Change Settings
                  </button>
                </div>
              )}

              <button 
                onClick={() => setShowSettingsModal(false)} 
                style={{ width: '100%', padding: '12px', background: '#bb86fc', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {winner && Array.isArray(winner) && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 15, 20, 0.95)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)', padding: '20px', overflowY: 'auto'
          }}>
            <style>{`
              @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
            `}</style>
            
            <h1 style={{ color: '#03dac6', fontSize: 'clamp(32px, 6vw, 55px)', margin: '0 0 5px 0', textShadow: '0 0 20px rgba(3, 218, 198, 0.5)', animation: 'scaleIn 0.5s ease-out' }}>
              MATCH RESULTS
            </h1>
            <p style={{ color: '#bb86fc', fontSize: '16px', margin: '0 0 30px 0', letterSpacing: '3px', fontWeight: 'bold' }}>
              FINAL LEADERBOARD & STATS
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%', maxWidth: '800px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '10px', height: '180px', marginTop: '10px' }}>
                
                {winner[1] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%', animation: 'slideUp 0.6s ease forwards', opacity: 0, animationDelay: '0.2s' }}>
                    <div style={{ fontSize: '20px', marginBottom: '5px', color: '#C0C0C0', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{winner[1].name}</div>
                    <div style={{ fontSize: '16px', color: '#fff', marginBottom: '10px' }}>{winner[1].score} pts</div>
                    <div style={{ width: '100%', height: '100px', background: 'linear-gradient(to top, #424242, #9E9E9E)', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px', fontSize: '40px' }}>🥈</div>
                  </div>
                )}
                
                {winner[0] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%', animation: 'slideUp 0.6s ease forwards', zIndex: 10 }}>
                    <div style={{ fontSize: '24px', marginBottom: '5px', color: '#FFD54F', fontWeight: '900', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textShadow: '0 0 10px rgba(255,215,0,0.4)' }}>{winner[0].name}</div>
                    <div style={{ fontSize: '18px', color: '#fff', marginBottom: '10px', fontWeight: 'bold' }}>{winner[0].score} pts</div>
                    <div style={{ width: '100%', height: '140px', background: 'linear-gradient(to top, #F57F17, #FFD54F)', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px', fontSize: '50px', boxShadow: '0 -10px 30px rgba(255,215,0,0.2)' }}>👑</div>
                  </div>
                )}
                
                {winner[2] && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%', animation: 'slideUp 0.6s ease forwards', opacity: 0, animationDelay: '0.4s' }}>
                    <div style={{ fontSize: '20px', marginBottom: '5px', color: '#CD7F32', fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{winner[2].name}</div>
                    <div style={{ fontSize: '16px', color: '#fff', marginBottom: '10px' }}>{winner[2].score} pts</div>
                    <div style={{ width: '100%', height: '70px', background: 'linear-gradient(to top, #4E342E, #8D6E63)', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10px', fontSize: '35px' }}>🥉</div>
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--bg-panel)', padding: '20px 25px', borderRadius: '16px', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'scaleIn 0.5s ease-out forwards', opacity: 0, animationDelay: '0.6s' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '16px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Performance Data</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '220px', overflowY: 'auto', paddingRight: '10px' }}>
                  {winner.map((p, idx) => {
                    const topScore = Math.max(winner[0]?.score || 1, 1);
                    const barWidth = Math.max((p.score / topScore) * 100, 2); 
                    
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '25px', color: '#888', fontWeight: 'bold', textAlign: 'right', fontSize: '14px' }}>#{idx + 1}</div>
                        <div style={{ width: '110px', color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '15px' }}>{p.name}</div>
                        <div style={{ flexGrow: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: `${barWidth}%`, height: '100%', background: idx === 0 ? '#FFD54F' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#bb86fc', borderRadius: '6px', transition: 'width 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)' }} />
                        </div>
                        <div style={{ width: '40px', textAlign: 'right', color: '#fff', fontWeight: 'bold', fontSize: '15px' }}>{p.score}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px', animation: 'scaleIn 0.5s ease-out forwards', opacity: 0, animationDelay: '1s' }}>
                {(!isPrivate || isHost) ? (
                  <button 
                    onClick={() => socketRef.current.emit('return_to_lobby')}
                    style={{ padding: '16px 36px', fontSize: '18px', fontWeight: '900', color: '#000', background: 'linear-gradient(135deg, #03dac6, #018786)', border: 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(3, 218, 198, 0.4)', transition: 'transform 0.1s ease', textTransform: 'uppercase', letterSpacing: '1px' }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    Proceed to Next Game ➡️
                  </button>
                ) : (
                  <div style={{ padding: '16px 32px', fontSize: '16px', color: '#bb86fc', background: 'rgba(187, 134, 252, 0.1)', border: '1px solid #bb86fc', borderRadius: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    ⏳ Waiting for Host to Proceed...
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
    </>
  )
}