const STORAGE_KEYS = {liked:"melodyspace-liked", playlists:"melodyspace-playlists", recent:"melodyspace-recent"};
const $ = (selector) => document.querySelector(selector);
const audio = $("#audioElement");
let currentView = "home", currentPlaylistId = null, currentArtist = null;
let queue = [...SONGS], queueIndex = -1, isShuffle = false, repeatMode = 0;
let liked = readStorage(STORAGE_KEYS.liked, []), playlists = readStorage(STORAGE_KEYS.playlists, []), recent = readStorage(STORAGE_KEYS.recent, []);
let toastTimer;
let lyricsOpen = false;
let activeLyricIndex = -1;
// FUNCTION: Reads a saved value from the browser's localStorage and returns a fallback if nothing valid is saved.
function readStorage(key, fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}}
// FUNCTION: Saves the user's liked songs, playlists, and recently played songs in the browser.
function saveStorage(){localStorage.setItem(STORAGE_KEYS.liked,JSON.stringify(liked));localStorage.setItem(STORAGE_KEYS.playlists,JSON.stringify(playlists));localStorage.setItem(STORAGE_KEYS.recent,JSON.stringify(recent))}
// FUNCTION: Escapes special HTML characters so text from song and artist data is displayed safely.
function esc(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
// FUNCTION: Converts a name into a simple lowercase value that can be used in image paths and artist filters.
function slug(value){return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
// FUNCTION: Finds one song in the SONGS array by matching its ID.
function getSong(id){return SONGS.find(s=>s.id===id)}
// FUNCTION: Shows a temporary notification message and hides it automatically after 2.6 seconds.
function showToast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
// FUNCTION: Creates the HTML image element used for a song's small cover image.
function songArt(song){return `<img class="track-thumb" src="${esc(song.cover || "")}" alt="${esc(song.title)} cover" loading="lazy">`}
// FUNCTION: Creates a music card containing a song cover, title, artist, and play button.
function card(song){return `<article class="music-card"><img class="artwork" src="${song.cover}" alt="${esc(song.title)}"><button class="card-play" data-play="${song.id}" aria-label="Play ${esc(song.title)}">▶</button><h3>${esc(song.title)}</h3><p>${esc(song.artist)}</p></article>`}
// FUNCTION: Creates a music card for an artist and adds a control for opening that artist's collection.
function artistCard(artist) {
    return `<article class="music-card">
        <img class="artwork artist-art"
             src="${esc(artist.artistImage || `images/${artist.slug}.jpg`)}"
             alt="${esc(artist.name)}"
             loading="lazy">
        <button class="card-play" data-artist="${artist.slug}">↗</button>
        <h3>${artist.name}</h3>
        <p>Artist</p>
    </article>`;
}function section(title,content,action=""){return `<section class="section"><div class="section-heading"><h2>${title}</h2>${action}</div>${content}</section>`}
// FUNCTION: Places a group of music cards inside the grid layout container.
function grid(items){return `<div class="card-grid">${items}</div>`}
// FUNCTION: Builds the Home page and its recently played, popular artist, top hit, album, and playlist sections.
function homeView(){
 const recentSongs=recent.map(getSong).filter(Boolean).slice(0,6);
 return `<h1 class="greeting">Good day, music lover!</h1>
 <section class="hero"><div class="hero-copy"><div class="eyebrow">Your soundtrack starts here</div><h2>Find your next favorite song.</h2><p>Explore featured artists, revisit your favorites, and make every moment sound better.</p><button class="primary-button" data-view="search">Explore music</button></div><div class="hero-art">♫</div></section>
 ${section("Recently Played",recentSongs.length?grid(recentSongs.map(card).join("")):`<div class="empty-state">Your recently played songs will appear here.</div>`)}
 ${section("Popular Artists",grid(ARTISTS.map(artistCard).join("")))}
 ${section("Top Hits",grid(SONGS.filter((s,i)=>[0,6,12,18,24,30,36,42,48,54].includes(i)).map(card).join("")))}
 ${section("Featured Albums",grid(ARTISTS.slice(0,6).map(a=>`<article class="music-card">
   <img class="artwork album-art" src="${esc(a.artistImage || `images/${a.slug}.jpg`)}" alt="${esc(a.name)} Collection" loading="lazy">
   <h3>${esc(a.name)} Collection</h3>
   <p>Featured collection</p>
   <button class="card-play" data-artist="${a.slug}" aria-label="Open ${esc(a.name)} collection">▶</button>
  </article>`).join("")))}
 ${section("Your Playlists",playlists.length?grid(playlists.map(p=>`<article class="music-card"><div class="artwork">♫</div><button class="card-play" data-playlist="${p.id}">▶</button><h3>${esc(p.name)}</h3><p>${p.songIds.length} songs</p></article>`).join("")):`<div class="empty-state"><h3>Make it yours</h3><p>Create a playlist and collect the songs you love.</p><button class="primary-button" id="homeCreatePlaylist">Create playlist</button></div>`)}
 `;
}
// FUNCTION: Checks whether the given song is the current song and whether the audio is actively playing.
function isSongPlaying(songId){return queue[queueIndex]?.id===songId && !!audio.src && !audio.paused;}
// FUNCTION: Builds the list of songs and adds controls to play, like, or add each song to a playlist.
function trackRows(songs){if(!songs.length)return `<div class="empty-state"><h3>No songs here yet</h3><p>Try another section or search for a track.</p></div>`;
 return `<div class="track-list">${songs.map((s,i)=>{const playing=isSongPlaying(s.id);return `<div class="track-row ${queue[queueIndex]?.id===s.id?"current":""}"><span class="track-number">${i+1}</span><div class="track-main">${songArt(s)}<div style="min-width:0"><div class="track-title">${esc(s.title)}</div><div class="track-sub">${esc(s.artist)}</div></div></div><div class="track-album">${esc(s.album)}</div><div class="track-actions"><button class="text-button play-inline ${playing?"is-playing":""}" data-track-toggle="${s.id}" aria-label="${playing?"Pause":"Play"} ${esc(s.title)}" title="${playing?"Pause":"Play"}">${playing?"Ⅱ":"▶"}</button><button class="text-button" data-like="${s.id}" aria-label="Like">${liked.includes(s.id)?"♥":"♡"}</button><button class="text-button" data-add="${s.id}" aria-label="Add to playlist">＋</button></div></div>`}).join("")}</div>`}
// FUNCTION: Builds the Search page, including the search field, artist filter buttons, and results area.
function searchView(){return `<h1 class="greeting">Search</h1><label class="search-box"><span>⌕</span><input id="searchInput" type="search" placeholder="What do you want to listen to?" autocomplete="off"></label><div class="filter-row"><button class="filter-chip active" data-filter="all">All</button>${ARTISTS.map(a=>`<button class="filter-chip" data-filter="${a.slug}">${esc(a.name)}</button>`).join("")}</div><div id="searchResults">${section("Explore all songs",trackRows(SONGS))}</div>`}
// FUNCTION: Builds the Library page, showing playlists, liked songs, and recently played songs.
function libraryView(){return `<h1 class="greeting">Your Library</h1>${section("Your Playlists",playlists.length?grid(playlists.map(p=>`<article class="music-card"><div class="artwork">♫</div><button class="card-play" data-playlist="${p.id}">▶</button><h3>${esc(p.name)}</h3><p>${p.songIds.length} songs</p></article>`).join("")):`<div class="empty-state"><h3>Your collection starts here</h3><p>Create a playlist to keep your music together.</p><button class="primary-button" id="libraryCreatePlaylist">Create playlist</button></div>`)}${section("Liked Songs",trackRows(SONGS.filter(s=>liked.includes(s.id))))}${section("Recently Played",trackRows(recent.map(getSong).filter(Boolean)))}`}
// FUNCTION: Builds a page containing only the songs saved in the user's liked list.
function likedView(){return `<h1 class="greeting">Liked Songs</h1><p class="muted">${liked.length} liked tracks</p>${trackRows(SONGS.filter(s=>liked.includes(s.id)))}`}
// FUNCTION: Builds a page containing the user's recently played songs.
function recentView(){return `<h1 class="greeting">Recently Played</h1>${trackRows(recent.map(getSong).filter(Boolean))}`}
// FUNCTION: Finds an artist and builds that artist's collection page with its songs and Play Collection button.
function artistView(slugValue){const artist=ARTISTS.find(a=>a.slug===slugValue);if(!artist)return homeView();currentArtist=artist.slug;const tracks=SONGS.filter(s=>s.artistSlug===artist.slug);return `<div class="artist-banner"><img class="artwork artist-art" src="${esc(artist.artistImage || `images/${artist.slug}.jpg`)}" alt="${esc(artist.name)}" loading="lazy"><div><div class="eyebrow">Artist collection</div><h1>${esc(artist.name)}</h1><p>${tracks.length} featured songs</p></div></div><div class="section"><button class="primary-button" data-playlist-artist="${artist.slug}">▶ Play collection</button></div>${trackRows(tracks)}`}
// FUNCTION: Finds a playlist and builds its page with its songs, play control, and delete control.
function playlistView(id){const p=playlists.find(x=>x.id===id);if(!p)return libraryView();currentPlaylistId=id;const tracks=p.songIds.map(getSong).filter(Boolean);return `<div class="playlist-header"><div class="playlist-cover">♫</div><div><div class="eyebrow">Playlist</div><h1>${esc(p.name)}</h1><p>${tracks.length} songs</p></div></div><div class="section"><button class="primary-button" data-playlist="${p.id}">▶ Play playlist</button> <button class="secondary-button" data-delete-playlist="${p.id}">Delete playlist</button></div>${trackRows(tracks)}`}
// FUNCTION: Chooses which page to display, inserts its HTML, updates navigation, and refreshes playback buttons.
function render(view=currentView, arg=null){currentView=view;const root=$("#viewRoot");if(view==="home")root.innerHTML=homeView();else if(view==="search")root.innerHTML=searchView();else if(view==="library")root.innerHTML=libraryView();else if(view==="liked")root.innerHTML=likedView();else if(view==="recent")root.innerHTML=recentView();else if(view==="artist")root.innerHTML=artistView(arg);else if(view==="playlist")root.innerHTML=playlistView(arg);else root.innerHTML=homeView();
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 updateSidebar();root.scrollTop=0;updateTrackPlayButtons();
}
// FUNCTION: Refreshes the playlist links shown in the website's sidebar.
function updateSidebar(){$("#sidebarPlaylistList").innerHTML=playlists.length?playlists.map(p=>`<button class="sidebar-playlist" data-playlist="${p.id}">${esc(p.name)}</button>`).join(""):`<p class="muted small">Your playlists will appear here.</p>`}
// FUNCTION: Updates song-row buttons and highlights so they match the current playback state.
function updateTrackPlayButtons(){
 document.querySelectorAll("[data-track-toggle]").forEach(button=>{
  const playing=isSongPlaying(button.dataset.trackToggle);
  button.textContent=playing?"Ⅱ":"▶";
  button.classList.toggle("is-playing",playing);
  button.setAttribute("aria-label",`${playing?"Pause":"Play"} ${getSong(button.dataset.trackToggle)?.title||"track"}`);
  button.title=playing?"Pause":"Play";
 });
 document.querySelectorAll(".track-row").forEach(row=>{
  const button=row.querySelector("[data-track-toggle]");
  if(button) row.classList.toggle("current",queue[queueIndex]?.id===button.dataset.trackToggle);
 });
}

// FUNCTION: Displays the selected song's details and creates clickable lyric lines using their timestamps.

function renderLyrics(song, resetScroll = true) {
    const panel = $("#lyricsPanel");
    const content = $("#lyricsContent");
    if (!panel || !content) return;

    if (!song) {
        $("#lyricsSongTitle").textContent = "Lyrics";
        $("#lyricsSongArtist").textContent = "Select a song to view its lyrics";
        content.innerHTML = `<p class="lyrics-empty">Choose a song, then open Lyrics.</p>`;
        activeLyricIndex = -1;
        return;
    }

    $("#lyricsSongTitle").textContent = song.title;
    $("#lyricsSongArtist").textContent = song.artist;
    const sideCover = $("#lyricsSideCover");
    if (sideCover) {
        sideCover.src = song.cover || "";
        sideCover.alt = `${song.title} by ${song.artist}`;
    }
    $("#lyricsSideTitle").textContent = song.title;
    $("#lyricsSideArtist").textContent = song.artist;
    $("#lyricsSideAlbum").textContent = song.album || "MelodySpace collection";
    const lines = LYRICS[song.id] || [];
    if (!lines.length) {
        content.innerHTML = `<p class="lyrics-empty">No timestamped lyrics have been added for this song yet.</p>`;
        activeLyricIndex = -1;
        return;
    }

    content.innerHTML = lines.map((line, index) =>
        `<p class="lyric-line" role="button" tabindex="0" style="cursor:pointer" data-lyric-index="${index}" data-lyric-time="${Number(line.time)}">${esc(line.text)}</p>`
    ).join("") + `<p class="lyrics-hint">Click a lyric line to play from that part of the song.</p>`;

    activeLyricIndex = -1;
    if (resetScroll) content.scrollTop = 0;
    updateActiveLyric();
}

// FUNCTION: Checks the current audio time, highlights the matching lyric line, and scrolls it into view.

function updateActiveLyric() {
    const song = queue[queueIndex];
    if (!song || !LYRICS[song.id]) return;

    const currentTime = audio.currentTime;
    const lines = LYRICS[song.id];

    let activeIndex = -1;

    lines.forEach((line, index) => {
        if (currentTime >= line.time) {
            activeIndex = index;
        }
    });

    const lyricElements = document.querySelectorAll(".lyric-line");

    lyricElements.forEach((element, index) => {
        element.classList.toggle("active", index === activeIndex);
    });

    if (activeIndex !== -1 && lyricsOpen) {
        if (lyricElements[activeIndex]) {
            lyricElements[activeIndex].scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }
    }
}

// FUNCTION: Opens or closes the lyrics panel and updates its accessibility information and page styling.

function toggleLyrics(force) {
    const panel = $("#lyricsPanel");
    if (!panel) return;
    lyricsOpen = typeof force === "boolean" ? force : !lyricsOpen;
    panel.classList.toggle("open", lyricsOpen);
    document.body.classList.toggle("lyrics-mode", lyricsOpen);
    panel.setAttribute("aria-hidden", String(!lyricsOpen));
    $("#lyricsButton").setAttribute("aria-expanded", String(lyricsOpen));
    $("#lyricsButton").setAttribute("aria-label", lyricsOpen ? "Close lyrics" : "Open lyrics");
    if (lyricsOpen) {
        renderLyrics(queue[queueIndex], false);
        updateActiveLyric();
    }
}

// FUNCTION: Creates a new playback queue, selects the requested starting song, and starts playing it.

function setQueue(songs,startId){queue=[...songs];queueIndex=queue.findIndex(s=>s.id===startId);if(queueIndex<0)queueIndex=0;playCurrent()}
// FUNCTION: Chooses the correct song collection for the current page and starts the selected song.
function playSong(id){const song=getSong(id);if(!song)return;let list=SONGS;if(currentView==="artist"&&currentArtist)list=SONGS.filter(s=>s.artistSlug===currentArtist);else if(currentView==="playlist"){const p=playlists.find(x=>x.id===currentPlaylistId);if(p)list=p.songIds.map(getSong).filter(Boolean)}else if(currentView==="liked")list=SONGS.filter(s=>liked.includes(s.id));else if(currentView==="recent")list=recent.map(getSong).filter(Boolean);setQueue(list,id)}
// FUNCTION: Loads the selected song, updates the player display, starts audio, and records the song in recent history.
function playCurrent(){const song=queue[queueIndex];if(!song)return;audio.pause();audio.src=song.src;audio.load();$("#playerTitle").textContent=song.title;$("#playerArtist").textContent=song.artist;$("#playerCover").innerHTML = song.cover ? `<img src="${esc(song.cover)}" alt="${esc(song.title)} cover">` : song.artist.slice(0,1);$("#playerLike").textContent=liked.includes(song.id)?"♥":"♡";$("#playerLike").classList.toggle("liked",liked.includes(song.id));$("#progressBar").value=0;$("#currentTime").textContent="0:00";$("#duration").textContent="0:00";$("#playButton").textContent="▶";$("#playerStatus").textContent="Checking local audio file…";
  renderLyrics(song);
 audio.play().then(()=>{$("#playButton").textContent="Ⅱ";$("#playerStatus").textContent="Playing";}).catch(()=>{$("#playButton").textContent="▶";$("#playerStatus").textContent="Audio unavailable. Add this MP3 to the songs folder.";showToast(`Add ${song.src} to enable playback.`)});
 recent=[song.id,...recent.filter(x=>x!==song.id)].slice(0,20);saveStorage();if(currentView==="home"||currentView==="recent")render(currentView);
}
// FUNCTION: Toggles the current audio between playing and paused states.
function togglePlay(){if(!audio.src){showToast("Choose a song first.");return}if(audio.paused){audio.play().then(()=>{$("#playButton").textContent="Ⅱ";$("#playerStatus").textContent="Playing";updateTrackPlayButtons()}).catch(()=>showToast("Audio file is unavailable."))}else{audio.pause();$("#playButton").textContent="▶";$("#playerStatus").textContent="Paused";updateTrackPlayButtons()}}
// FUNCTION: Moves to the next song in the queue or chooses a random song when shuffle is enabled.
function nextTrack(){if(!queue.length)return;if(isShuffle&&queue.length>1){let next;do{next=Math.floor(Math.random()*queue.length)}while(next===queueIndex);queueIndex=next}else queueIndex=(queueIndex+1)%queue.length;playCurrent()}
// FUNCTION: Restarts the current song if it has played for more than three seconds; otherwise moves to the previous song.
function previousTrack(){if(audio.currentTime>3){audio.currentTime=0;return}queueIndex=(queueIndex-1+queue.length)%queue.length;playCurrent()}
// FUNCTION: Adds or removes a song from the liked list, saves the change, and refreshes the relevant display.
function toggleLike(id){const index=liked.indexOf(id);if(index>=0)liked.splice(index,1);else liked.push(id);saveStorage();if(queue[queueIndex]?.id===id){$("#playerLike").textContent=liked.includes(id)?"♥":"♡";$("#playerLike").classList.toggle("liked",liked.includes(id))}if(["liked","library"].includes(currentView))render(currentView);else if(currentView==="artist")render("artist",currentArtist);else if(currentView==="playlist")render("playlist",currentPlaylistId);else if(currentView==="search")runSearch($("#searchInput")?.value||"");}
// FUNCTION: Asks the user for a playlist name, creates an empty playlist, saves it, and opens it.
function createPlaylist(){const name=prompt("Enter a name for your playlist:");if(!name||!name.trim())return;const playlist={id:`playlist-${Date.now()}`,name:name.trim(),songIds:[]};playlists.push(playlist);saveStorage();updateSidebar();render("playlist",playlist.id);showToast("Playlist created.");}
// FUNCTION: Asks which playlist to use and adds the selected song if it is not already included.
function addToPlaylist(songId){if(!playlists.length){showToast("Create a playlist first.");return}const options=playlists.map((p,i)=>`${i+1}. ${p.name}`).join("\n");const choice=prompt(`Choose a playlist number:\n${options}`);const p=playlists[Number(choice)-1];if(!p)return;if(!p.songIds.includes(songId))p.songIds.push(songId);saveStorage();showToast(`Added to ${p.name}.`);if(currentView==="playlist")render("playlist",currentPlaylistId)}
// FUNCTION: Filters the SONGS array using the search text and artist filter, then displays the matching songs.
function runSearch(query,filter="all"){const q=query.toLowerCase().trim();const results=SONGS.filter(s=>(filter==="all"||s.artistSlug===filter)&&(!q||s.title.toLowerCase().includes(q)||s.artist.toLowerCase().includes(q)));$("#searchResults").innerHTML=section(`${results.length} matching songs`,trackRows(results));}
// FUNCTION: Calls the playlist creation function when the Create Playlist action is used.
function showModal(){createPlaylist()}

// Jump to the selected lyric's timestamp in the currently playing song.
// FUNCTION: Moves the audio to the timestamp attached to the lyric line selected by the user.
function seekToLyric(lineElement) {
 const time = Number(lineElement?.dataset.lyricTime);
 if (!Number.isFinite(time) || !audio.src || !queue[queueIndex]) return;
 audio.currentTime = Math.min(time, Number.isFinite(audio.duration) ? audio.duration : time);
 updateActiveLyric();
 if (audio.paused) audio.play().catch(() => showToast("Audio file is unavailable."));
}

// EVENT HANDLER: Runs when the user clicks the page. It checks which control was clicked and performs the matching action.
document.addEventListener("click",e=>{
 const lyric = e.target.closest(".lyric-line");
 if (lyric) { seekToLyric(lyric); return; }
 const b=e.target.closest("button");if(!b)return;
 if(b.dataset.view){render(b.dataset.view);$("#sidebar").classList.remove("mobile-open");$("#menuToggle").setAttribute("aria-expanded","false");return}
 if(b.dataset.trackToggle){
  const id=b.dataset.trackToggle;
  if(queue[queueIndex]?.id===id){togglePlay();}else{playSong(id);}
  updateTrackPlayButtons();
  return;
 }
 if(b.dataset.play){playSong(b.dataset.play);return}
 if(b.dataset.artist){render("artist",b.dataset.artist);return}
 if(b.dataset.playlist){const p=playlists.find(x=>x.id===b.dataset.playlist);if(p){if(b.classList.contains("card-play")||b.textContent.includes("Play playlist"))setQueue(p.songIds.map(getSong).filter(Boolean),p.songIds[0]);else render("playlist",p.id)}return}
 if(b.dataset.playlistArtist){const list=SONGS.filter(s=>s.artistSlug===b.dataset.playlistArtist);setQueue(list,list[0]?.id);return}
 if(b.dataset.like){toggleLike(b.dataset.like);return}
 if(b.dataset.add){addToPlaylist(b.dataset.add);return}
 if(b.dataset.deletePlaylist){if(confirm("Delete this playlist?")){playlists=playlists.filter(p=>p.id!==b.dataset.deletePlaylist);saveStorage();render("library");showToast("Playlist deleted.")}return}
 if(b.id==="createPlaylist"||b.id==="homeCreatePlaylist"||b.id==="libraryCreatePlaylist"){createPlaylist();return}
 if(b.id==="lyricsButton"){toggleLyrics();return}
 if(b.id==="playButton"){togglePlay();return}
 if(b.id==="nextButton"){nextTrack();return}
 if(b.id==="previousButton"){previousTrack();return}
 if(b.id==="shuffleButton"){isShuffle=!isShuffle;b.classList.toggle("active",isShuffle);showToast(isShuffle?"Shuffle on":"Shuffle off");return}
 if(b.id==="repeatButton"){repeatMode=(repeatMode+1)%3;b.classList.toggle("active",repeatMode>0);b.textContent=repeatMode===2?"↻¹":"↻";b.title=["Repeat off","Repeat playlist","Repeat current track"][repeatMode];showToast(b.title);return}
 if(b.id==="playerLike"){const s=queue[queueIndex];if(s)toggleLike(s.id);return}
 if(b.id==="muteButton"){audio.muted=!audio.muted;b.classList.toggle("active",audio.muted);b.textContent=audio.muted?"×":"◖";return}
 if(b.dataset.filter){document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));runSearch($("#searchInput")?.value||"",b.dataset.filter);return}
 if(b.id==="menuToggle"){const sidebar=$("#sidebar");const isOpen=sidebar.classList.toggle("mobile-open");b.setAttribute("aria-expanded",String(isOpen));return}
});

// Close lyrics when clicking outside the visible lyrics columns.
// Clicks inside the lyric text or song-information panel keep it open.
// EVENT HANDLER: Detects a pointer press outside the lyrics panel so the panel can close automatically.
document.addEventListener("pointerdown", e => {
    if (!lyricsOpen) return;

    // Keep lyrics open while the user interacts with the bottom music player.
    // The Lyrics button itself still toggles the lyrics panel normally.
    if (e.target.closest("#lyricsButton") || e.target.closest(".player")) return;

    const insideLyricsPanel =
        e.target.closest(".lyrics-stage") ||
        e.target.closest(".lyrics-side-panel");

    if (!insideLyricsPanel) toggleLyrics(false);
});

// EVENT HANDLER: Lets the user activate a lyric line with the Enter or Space key.
document.addEventListener("keydown", e => {
 if ((e.key === "Enter" || e.key === " ") && e.target.matches(".lyric-line")) {
  e.preventDefault();
  seekToLyric(e.target);
 }
});
// EVENT HANDLER: On small screens, closes the mobile sidebar when the user clicks somewhere outside it.
document.addEventListener("click",e=>{if(window.matchMedia("(max-width: 767px)").matches){const sidebar=$("#sidebar");if(sidebar.classList.contains("mobile-open")&&!e.target.closest("#sidebar")&&!e.target.closest("#menuToggle")){sidebar.classList.remove("mobile-open");$("#menuToggle").setAttribute("aria-expanded","false")}}});
// EVENT HANDLER: Responds to search typing and changes to the playback progress and volume controls.
document.addEventListener("input",e=>{if(e.target.id==="searchInput")runSearch(e.target.value,document.querySelector("[data-filter].active")?.dataset.filter||"all");if(e.target.id==="progressBar"&&audio.duration)audio.currentTime=(Number(e.target.value)/100)*audio.duration;if(e.target.id==="volumeBar")audio.volume=Number(e.target.value)});
audio.volume=.75;
// AUDIO CALLBACK: Updates the player interface when the browser starts playing the audio.
audio.addEventListener("play",()=>{$("#playButton").textContent="Ⅱ";$("#playerStatus").textContent="Playing";updateTrackPlayButtons()});
// AUDIO CALLBACK: Updates the player interface when the audio is paused.
audio.addEventListener("pause",()=>{$("#playButton").textContent="▶";if(audio.src)$("#playerStatus").textContent="Paused";updateTrackPlayButtons()});
// AUDIO CALLBACK: Updates the progress bar, time labels, and synchronized lyrics while the song plays.
audio.addEventListener("timeupdate",()=>{if(!audio.duration)return;$("#progressBar").value=(audio.currentTime/audio.duration)*100;$("#currentTime").textContent=formatTime(audio.currentTime);$("#duration").textContent=formatTime(audio.duration);updateActiveLyric()});
// AUDIO CALLBACK: Chooses whether to repeat the song, continue the playlist, or stop when a song ends.
audio.addEventListener("ended",()=>{if(repeatMode===2){audio.currentTime=0;audio.play().catch(()=>{});return}if(repeatMode===1&&queueIndex===queue.length-1){queueIndex=0;playCurrent();return}if(queueIndex<queue.length-1||repeatMode===1)nextTrack();else{$("#playButton").textContent="▶";$("#playerStatus").textContent="Finished"}});
// AUDIO CALLBACK: Displays a message when the selected audio file cannot be played.
audio.addEventListener("error",()=>{$("#playerStatus").textContent="Audio unavailable. Add a legally obtained MP3 file.";});
// FUNCTION: Converts a number of seconds into a minutes-and-seconds display such as 125 becoming 2:05.
function formatTime(seconds){if(!Number.isFinite(seconds))return"0:00";const m=Math.floor(seconds/60),s=Math.floor(seconds%60);return `${m}:${String(s).padStart(2,"0")}`}
// BUTTON CALLBACKS: The Back button opens Home, while the Forward button opens the Library.
$("#goBack").addEventListener("click",()=>render("home"));$("#goForward").addEventListener("click",()=>render("library"));
// BUTTON CALLBACK: Shows a welcome message when the profile button is clicked.
$("#profileButton").addEventListener("click",()=>showToast("Welcome to MelodySpace!"));

// lyrics be close by clicking outside.
document.querySelectorAll("#lyricsCloseButton, .lyrics-close").forEach(button => button.remove());
render("home");
renderLyrics(null);
updateTrackPlayButtons();
