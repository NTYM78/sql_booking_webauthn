const getSlotsButton = document.getElementById('getslotsbutton');
if (getSlotsButton) {
    getSlotsButton.addEventListener('click', getSlots)
}

// Clear slot list if name field change 
const userNameField = document.getElementById('username');
if (userNameField) {
    userNameField.addEventListener('change', function() {
        clearSlotList();
    })
}

const clockInButton = document.getElementById('clockInButton');
if (clockInButton) {
    clockInButton.addEventListener('click', clockIn);
}

const clockOutButton = document.getElementById('clockOutButton');
if (clockOutButton) {
    clockOutButton.addEventListener('click', clockOut);
}

// Hide clock in page content first
document.getElementById('clockInContent').style.display = 'none';

// Initialise variables
var userID = 0;
var slotID;
var data;

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'};
    return date.toLocaleDateString('en-us', options);
}

function formatTime(timeString) {
    const time = new Date(`1970-01-01T${timeString}`);
    const options = {hour: 'numeric', minute: 'numeric', hour12: true};
    return time.toLocaleTimeString('en-US', options);
}

function getCurrentDateTime() {
    const now = new Date();

    // Format the date components
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() is zero-based
    const day = String(now.getDate()).padStart(2, '0');

    // Format the time components
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // Combine them into the desired format: "YYYY-MM-DD HH:mm:ss"
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function loginUser() {
    common.showMessage("message", "", false);
    const username = document.getElementById('username').value;

    if (!canLogin) {
        common.common.showMessage("message","Please enable camera permission in order to login.", true);
        return
    }

    try {
        const response = await fetch(`${common.apiUrl}/user/login/begin`, {
            method: 'POST',
            credentials: 'include', // Include cookies in the request
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        if (!response.ok) {
            const msg = await response.json();
            throw new Error('Failed to get login options from server: ' + msg);
        }

        const { options, session_id } = await response.json();

        const assertionResponse = await SimpleWebAuthnBrowser.startAuthentication(options.publicKey);

        const verificationResponse = await fetch(`${common.apiUrl}/user/login/finish?session_id=${session_id}&slot_id=${slotID}`, {
            method: 'POST',
            credentials: 'include', // Include cookies in the request
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assertionResponse)
        });

        var { message, userid } = await verificationResponse.json(); 
        if (verificationResponse.ok) {
            isLoggedIn();
            common.showMessage("Login successful: " + message, false);
            window.location.reload();
        } else {
            common.showMessage("Login failed: " + message, true);
        }
    } catch (error) {
        common.showMessage("message", 'Error: ' + error.message, true);
    }
}

function clearSlotList() {
    const existingContainer = document.getElementById('slotContainer');
    if (existingContainer) {
        existingContainer.remove();
    }
}

async function getSlots() {
    common.showMessage("message", "", false);

    // Show loading spinner
    const slotContainer = document.createElement('div');
    slotContainer.id = "slotContainer";
    slotContainer.className = "container mt-5";
    slotContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';

    const username = document.getElementById('username').value;
    if (username == "") {
        common.showMessage("message", "Please enter a username to get slots.", true);
        return
    }
    // Remove any existing slot container
    clearSlotList();

    slotLocation.appendChild(slotContainer);

    // Fetch the slots via API
    await fetch(`${common.apiUrl}/user/getUpcomingSlot?username=${username}`)
        .then(async response => {
            if (!response.ok) {
                const msg = await response.json();
                common.showMessage("message", "Error: " + msg, true);
                throw new Error(msg);
            }
            return response.json();
        })
        .then(data => {
            // Clear existing slots and remove loading spinner
            slotContainer.innerHTML = '';

            if (!data.slotList || data.slotList.length === 0) {
                slotContainer.innerHTML = '<p>No slots available to clock in / clock out.</p>';
                return;
            }

        data.slotList.forEach(slot => {
            const startTime = new Date(`${slot.slotDate}T${slot.startTime}`);
            const endTime = new Date(`${slot.slotDate}T${slot.endTime}`);
            const timeNow = new Date();
            const oneHourBefore = new Date(startTime.getTime() - (60 * 60 * 1000)); // Time allowed to clock in before start time
            const oneHourAfter = new Date(endTime.getTime() + (60 * 60 * 1000)); // Time allowed to clock in after end time
            
            const dateFormatted = formatDate(slot.slotDate);
            const startTimeFormatted = formatTime(slot.startTime);
            const endTimeFormatted = formatTime(slot.endTime);

            let clockInTime = slot.clockInTime ? formatTime(slot.clockInTime) : "";
            let clockOutTime = slot.clockOutTime ? formatTime(slot.clockOutTime) : "";

            const slotDiv = document.createElement('div');
            slotDiv.className = 'card mt-3'; // Bootstrap card style
            slotDiv.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${slot.slotName} - ${slot.branchName}</h5>
                <p class="card-text">
                    Date: ${dateFormatted} <br>
                    Time: ${startTimeFormatted} - ${endTimeFormatted} <br>
                    Clock In: ${clockInTime} <br>
                    Clock Out: ${clockOutTime} <br>
                    Remark: ${slot.remark ? slot.remark : 'None'}
                </p>
            </div>
            `;

            if (timeNow >= oneHourBefore && timeNow <=endTime && !slot.clockInTime) {
                const clockInbtn = document.createElement('button');
                clockInbtn.className = 'btn btn-success select-slot';
                clockInbtn.dataset.slotid =slot.slotID;
                clockInbtn.innerHTML = "Clock In";
                slotDiv.querySelector('.card-body').appendChild(clockInbtn);

                clockInbtn.addEventListener('click', function() {
                    slotID = slot.slotID;
                    localStorage.setItem('slotName', slot.slotName);
                    localStorage.setItem('clockIn', slot.clockInTime);
                    localStorage.setItem('clockOut', slot.clockOutTime);
                    loginUser();
                })
            }
            else if (timeNow >= startTime && timeNow <= oneHourAfter && slot.clockInTime && !slot.clockOutTime) {
                const clockOutbtn = document.createElement('button');
                clockOutbtn.className = 'btn btn-danger select-slot';
                clockOutbtn.dataset.slotid = slot.slotID;
                clockOutbtn.innerHTML = "Clock Out";
                slotDiv.querySelector('.card-body').appendChild(clockOutbtn);

                clockOutbtn.addEventListener('click', function() {
                    slotID = slot.slotID;
                    localStorage.setItem('slotName', slot.slotName);
                    localStorage.setItem('clockIn', slot.clockInTime);
                    localStorage.setItem('clockOut', slot.clockOutTime);
                    loginUser();
                })
            }
            slotContainer.appendChild(slotDiv);  
        });
    })
    .catch(error => {
        console.error("Error fetching slots: ", error);
        slotContainer.innerHTML = '<p class="text-danger">Failed to retrieve slots. Please try again later.</p>';
    });
}

clockInPage = document.getElementById('clockInContent');

async function isLoggedIn() {
    const response = await fetch(`${common.apiUrl}/user/GetLoginStatus`, {
        method: 'GET',
        credentials: 'include', // Include cookies in the request
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        const msg = await response.json();
        if (clockInPage) {
            // document.getElementById('clockInContent').style.display = 'none';
            document.getElementById('clockInContent').innerHTML = `
            <div class="container mt-5">    
                <h3 class="text-center">Nice try. You are not logged in.</h3>
            </div>
            `;
        }      
        throw new Error('Failed to get login status: ' + msg);
    }

    document.getElementById('loginContent').style.display = 'none';
    document.getElementById('clockInContent').style.display = 'block';

    clockInTime = localStorage.getItem('clockIn');
    clockOutTime = localStorage.getItem('clockOut');

    if (clockInTime == "undefined") {
        console.log("Entered")
        document.getElementById('slotTitle').innerHTML = `<h1>Clock in for ${localStorage.getItem('slotName')}</h1>`;
        document.getElementById('clockInButton').style.display = 'inline';
        document.getElementById('clockOutButton').style.display = 'none';
    } else if (clockInTime != "undefined" && clockOutTime == "undefined") {
        document.getElementById('slotTitle').innerHTML = `<h1>Clock in for ${localStorage.getItem('slotName')}</h1>`;
        document.getElementById('clockInButton').style.display = 'none';
        document.getElementById('clockOutButton').style.display = 'inline';
        console.log("Entered other")
    }

    const { message, user_id } = await response.json();
    userID = user_id;

    console.log("userID: ", userID);
}

async function clockIn() {
    if (data == null) {
        alert('You cannot clock in without a photo');
        return;
    }
    const ClockInImg = data.split(",")[1];

    const timeNow = getCurrentDateTime();
    const bodyData =
        {"userID": `${userID}`,"ClockInTime": `${timeNow}`, "ClockInImg": `${ClockInImg}`};

    const response = await fetch(`${common.apiUrl}/slot/WebUpdateBooking`, {
        method: 'PUT',
        credentials: 'include', // Include cookies in the request
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('Error updating clock-in time: ', error);
        alert("Clocking in failed. : "+ error);
        window.location.reload();
        return
    }

    window.location.reload();
    alert("you have clocked in");
}

async function clockOut() {
    if (data == null) {
        alert('you cannot clock out without a photo');
        return;
    }

    const ClockOutImg = data.split(",")[1];

    const timeNow = getCurrentDateTime();
    const bodyData =
        {"userID": `${userID}`, "ClockOutTime": `${timeNow}`, "ClockOutImg": `${ClockOutImg}`};
    

    const response = await fetch(`${common.apiUrl}/slot/WebUpdateBooking`, {
        method: 'PUT',
        credentials: 'include', // Include cookies in the request
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('Error updating clock-out time: ', error);
        alert("Clocking out failed. : "+ error);
        window.location.reload();
        return
    }

    window.location.reload();
    alert("you have clocked out");
}
    
isLoggedIn();

// ----------------------- Camera section ----------------------- //
video = document.querySelector("#videoElement");
photo = document.getElementById('photo');
takePhotoButton = document.getElementById('takePhotoButton');
canvas = document.getElementById('canvas');
output = document.getElementById('output')
if (output) {
    output.style.display = 'none';
}

var canLogin = false;

if (takePhotoButton) {
    takePhotoButton.addEventListener('click', takePicture);
}

navigator.permissions.query({ name: 'camera' })
    .then((permissionObj) => {
        console.log(permissionObj.state);
        if (permissionObj.state === "granted") {
            canLogin = true;
        }
    })
    .catch((error) => {
        console.log('Got error :', error);
    })

if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (stream) {
            video.srcObject = stream;
        })
        .catch(function (error) {
            console.log("Something went wrong: Camera object not found: " + error);
        });
}

function takePicture() {
    document.getElementById('videoContainer').style.display = 'none';
    output.style.display = 'flex';

    canvas.style.display = 'none';

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    data = canvas.toDataURL("image/jpeg", 1);
    photo.setAttribute("src", data);

    console.log(data);

    allowRetakePhoto();

}

function allowRetakePhoto() {
    takePhotoButton.textContent = "Retake photo";
    takePhotoButton.removeEventListener("click", takePicture);

    takePhotoButton.addEventListener('click', function() {
        data = null;

        photo.removeAttribute('src');

        takePhotoButton.textContent = "Take photo";
        document.getElementById('videoContainer').style.display = 'block';
        output.style.display = 'none';
        takePhotoButton.addEventListener('click', takePicture);
    })
}