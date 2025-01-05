const APP_ID = sessionStorage.getItem('app_id')
const TOKEN = sessionStorage.getItem('token')
const CHANNEL = sessionStorage.getItem('room')
let UID = sessionStorage.getItem('UID')
let NAME = sessionStorage.getItem('name')

const client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})

let localTracks = []
let remoteUsers = {}

let joinAndDisplayLocalStream = async () => {
    if (!TOKEN || !CHANNEL || !UID || !NAME) {
        window.open('/', '_self')
        return
    }

    document.getElementById('room-name').innerText = CHANNEL

    client.on('user-published', handleUserJoined)
    client.on('user-left', handleUserLeft)

    try {
        UID = await client.join(APP_ID, CHANNEL, TOKEN, UID)
    } catch(error) {
        console.error('Failed to join channel:', error)
        window.open('/', '_self')
        return
    }
    
    try {
        localTracks = await AgoraRTC.createMicrophoneAndCameraTracks()
    } catch(error) {
        console.error('Failed to create local tracks:', error)
        handleError(error)
        return
    }

    try {
        let member = await createMember()
        createVideoContainer(UID, member.name)
        localTracks[1].play(`user-${UID}`)
        await client.publish([localTracks[0], localTracks[1]])
    } catch(error) {
        console.error('Failed to setup local stream:', error)
        handleError(error)
    }
}

const createVideoContainer = (uid, name) => {
    let player = `<div class="video-container" id="user-container-${uid}">
                    <div class="video-player" id="user-${uid}"></div>
                    <div class="username-wrapper"><span class="user-name">${name}</span></div>
                 </div>`
    
    document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)
}

let handleUserJoined = async (user, mediaType) => {
    remoteUsers[user.uid] = user
    await client.subscribe(user, mediaType)

    if (mediaType === 'video') {
        let player = document.getElementById(`user-container-${user.uid}`)
        if (player) player.remove()

        try {
            let member = await getMember(user)
            createVideoContainer(user.uid, member.name)
            user.videoTrack.play(`user-${user.uid}`)
        } catch(error) {
            console.error('Error displaying remote video:', error)
        }
    }

    if (mediaType === 'audio') {
        try {
            user.audioTrack.play()
        } catch(error) {
            console.error('Error playing remote audio:', error)
        }
    }
}

let handleUserLeft = async (user) => {
    delete remoteUsers[user.uid]
    let player = document.getElementById(`user-container-${user.uid}`)
    if (player) player.remove()
}

let leaveAndRemoveLocalStream = async () => {
    for (let track of localTracks) {
        track.stop()
        track.close()
    }

    try {
        await client.leave()
        await deleteMember()
        window.open('/', '_self')
    } catch(error) {
        console.error('Error leaving channel:', error)
    }
}

let toggleCamera = async (e) => {
    try {
        if(localTracks[1].muted){
            await localTracks[1].setMuted(false)
            e.target.style.backgroundColor = '#fff'
        } else {
            await localTracks[1].setMuted(true)
            e.target.style.backgroundColor = 'rgb(255, 80, 80, 1)'
        }
    } catch(error) {
        console.error('Error toggling camera:', error)
    }
}

let toggleMic = async (e) => {
    try {
        if(localTracks[0].muted){
            await localTracks[0].setMuted(false)
            e.target.style.backgroundColor = '#fff'
        } else {
            await localTracks[0].setMuted(true)
            e.target.style.backgroundColor = 'rgb(255, 80, 80, 1)'
        }
    } catch(error) {
        console.error('Error toggling microphone:', error)
    }
}

let createMember = async () => {
    try {
        let response = await fetch('/create_member/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({'name': NAME, 'room_name': CHANNEL, 'UID': UID})
        })
        if (!response.ok) {
            throw new Error('Network response was not ok')
        }
        let member = await response.json()
        return member
    } catch(error) {
        console.error('Error creating member:', error)
        throw error
    }
}

let getMember = async (user) => {
    try {
        let response = await fetch(`/get_member/?UID=${user.uid}&room_name=${CHANNEL}`)
        if (!response.ok) {
            throw new Error('Network response was not ok')
        }
        let member = await response.json()
        return member
    } catch(error) {
        console.error('Error getting member:', error)
        throw error
    }
}

let deleteMember = async () => {
    try {
        let response = await fetch('/delete_member/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({'name': NAME, 'room_name': CHANNEL, 'UID': UID})
        })
        if (!response.ok) {
            throw new Error('Network response was not ok')
        }
        let member = await response.json()
        return member
    } catch(error) {
        console.error('Error deleting member:', error)
    }
}

const handleError = async (error) => {
    await leaveAndRemoveLocalStream()
    window.open('/', '_self')
}

window.addEventListener("beforeunload", deleteMember)
window.addEventListener("unload", deleteMember)

joinAndDisplayLocalStream()

document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)