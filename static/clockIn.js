const userLoginButton = document.getElementById('userLoginButton');
if (userLoginButton) {
    userLoginButton.addEventListener('click', loginUser);
}

const getSlotsButton = document.getElementById('getslotsbutton');
if (getSlotsButton) {
    getSlotsButton.addEventListener('click', getSlots)
}

const userNameField = document.getElementById('username');
if (userNameField) {
    userNameField.addEventListener('change', function() {
        console.log("username field was changed");
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
document.getElementById('clockInContent').style.display = 'none';

// Initialise variables
var userID = 0;
let slotID;
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

function formatDateTimeWithTime(clockInTime) {
    const now = new Date();

    // Extract the current date components
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() is zero-based
    const day = String(now.getDate()).padStart(2, '0');

    // Combine the date with the provided time (clockInTime)
    const formattedDateTime = `${year}-${month}-${day} ${clockInTime}`;

    return formattedDateTime;
}

async function loginUser() {
    showMessage("message", "", false);
    
    const username = document.getElementById('username').value;

    // if (selectedSlot == null) {
    //     showMessage("message", "Please select a slot before logging in.", true);
    //     return
    // }

    if (!canLogin) {
        showMessage("message","Please enable camera permission in order to login.", true);
        return
    }

    try {
        const response = await fetch('http://localhost:8082/user/login/begin', {
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

        const verificationResponse = await fetch(`http://localhost:8082/user/login/finish?session_id=${session_id}&slot_id=${slotID}`, {
            method: 'POST',
            credentials: 'include', // Include cookies in the request
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assertionResponse)
        });

        var { message, userid } = await verificationResponse.json(); 
        if (verificationResponse.ok) {
            user_id = userid;

            // Store user_id in localStorage
            // localStorage.setItem('slotID', selectedSlot);

            isLoggedIn();
            showMessage("Login successful: " + message, false);
            // window.location.href = "userClockInPage.html";
            window.location.reload();
        } else {
            showMessage("Login failed: " + message, true);
        }
    } catch (error) {
        showMessage("message", 'Error: ' + error.message, true);
    }
}

function clearSlotList() {
    const existingContainer = document.getElementById('slotContainer');
    if (existingContainer) {
        existingContainer.remove();
    }
    // selectedSlot = null;
}

async function getSlots() {
    showMessage("message", "", false);
    // selectedSlot = null;

    // Show loading spinner
    const slotContainer = document.createElement('div');
    slotContainer.id = "slotContainer";
    slotContainer.className = "container mt-5";
    slotContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';

    const username = document.getElementById('username').value;
    if (username == "") {
        showMessage("message", "Please enter a username to get slots.", true);
        return
    }
    // Remove any existing slot container
    clearSlotList();

    slotLocation.appendChild(slotContainer);

    // Fetch the slots via API
    await fetch(`http://localhost:8082/user/getUpcomingSlot?username=${username}`)
        .then(async response => {
            if (!response.ok) {
                const msg = await response.json();
                showMessage("message", "Error: " + msg, true);
                throw new Error('Network response was not ok');
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
            const startTime = new Date(`${slot.date}T${slot.startTime}`);
            const endTime = new Date(`${slot.date}T${slot.endTime}`);
            const timeNow = new Date();
            const oneHourBefore = new Date(startTime.getTime() - (60 * 60 * 1000)); // Time allowed to clock in before start time
            const oneHourAfter = new Date(endTime.getTime() + (60 * 60 * 1000)); // Time allowed to clock in after end time
            
            const dateFormatted = formatDate(slot.date);
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
                    localStorage.setItem('clockIn', slot.clockInTime);
                    localStorage.setItem('clockOut', slot.clockOutTime);
                    loginUser();
                })
            }

            slotContainer.appendChild(slotDiv);  
            
        //     document.querySelectorAll('.select-slot').forEach(button => {
        //     button.addEventListener('click', function () {
        //         const slotID = this.getAttribute('data-slotid');
        //         // const clockInTime = this.getAttribute('data-clockInTime');
        //         // const clockOutTime = this.getAttribute('data-clockOutTime');

        //         // Visual feedback for the selected slot
        //         // document.querySelectorAll('.select-slot').forEach(btn => {
        //         //     btn.classList.remove('btn-success');
        //         //     btn.classList.add('btn-primary');
        //         //     btn.innerHTML = "Select Slot";
        //         // });

        //         console.log(slot.clockInTime);
        //         console.log(slot.clockOutTime);
        //         localStorage.setItem('slotID', slotID);
        //         localStorage.setItem('clockIn', slot.clockInTime);
        //         localStorage.setItem('clockOut', slot.clockOutTime);

        //         this.classList.remove('btn-primary');
        //         this.classList.add('btn-success');
        //         this.innerHTML = "Slot Selected";

        //         console.log('Selected Slot ID:', slotID);
        //         selectedSlot = slotID;
        //     });
        // });
        });

          
            // Create and display the slot list
            // const slot = data.slotList[0];

         
            // console.log("time now: ", timeNow);
            // console.log("oneHourBefore: ", oneHourBefore)
            // console.log("End time: ", endTime)

            // if (timeNow >= oneHourBefore && timeNow <= endTime) {

                // Add event listeners for slot selection
               
            // } else {
            //     // If not within 1 hour before the start time, show empty message
            //     slotContainer.innerHTML = '<p>No slots available to clock in / clock out at this time.</p>';
            // }
        })
        .catch(error => {
            console.error("Error fetching slots: ", error);
            slotContainer.innerHTML = '<p class="text-danger">Failed to retrieve slots. Please try again later.</p>';
        });
}

clockInPage = document.getElementById('clockInContent');

async function isLoggedIn() {
    const response = await fetch('http://localhost:8082/user/GetLoginStatus', {
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

    // const selectedSlot = localStorage.getItem('slotID');
    // if (selectedSlot) {
    //     console.log("Restored selected slot: ", selectedSlot);
    //     // Perform any necessary actions with the restored slot (e.g., preselect it)
    // }

    clockInTime = localStorage.getItem('clockIn');
    clockOutTime = localStorage.getItem('clockOut');

    if (clockInTime == "null" && clockOutTime == "null") {
        console.log("entered");
        document.getElementById('clockInButton').style.display = 'inline';
        document.getElementById('clockOutButton').style.display = 'none';
    } else if (clockInTime != "null" && clockOutTime == "null") {
        console.log("entered other");
        document.getElementById('clockInButton').style.display = 'none';
        document.getElementById('clockOutButton').style.display = 'inline';
    }

    const { message, user_id } = await response.json();
    userID = user_id;

    console.log("user id : ", userID);
}

async function clockIn() {
    if (data == null) {
        alert('you cannot clock in without a photo');
        return;
    }

    // selectedSlot = localStorage.getItem('slotID');
    const ClockInImg = data.split(",")[1];

    const timeNow = getCurrentDateTime();
    const bodyData =
        {"userID": `${userID}`,"ClockInTime": `${timeNow}`, "ClockInImg": `${ClockInImg}`};

    const response = await fetch('http://localhost:8082/slot/WebUpdateBooking', {
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

    // selectedSlot = localStorage.getItem('slotID');
    // clockInTime = localStorage.getItem('clockIn');
    // const formattedClockIn = formatDateTimeWithTime(localStorage.getItem('clockIn'));
    const ClockOutImg = data.split(",")[1];

    const timeNow = getCurrentDateTime();
    const bodyData =
        {"userID": `${userID}`, "ClockOutTime": `${timeNow}`, "ClockOutImg": `${ClockOutImg}`};
    

    const response = await fetch(`http://localhost:8082/slot/WebUpdateBooking`, {
        method: 'PUT',
        credentials: 'include', // Include cookies in the request
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('Error updating clock-in time: ', error);
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
            console.log("Something went wrong: Camera object not found");
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

    data = canvas.toDataURL("image/png");
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