const registerButton = document.getElementById('registerButton');
if (registerButton) {
    registerButton.addEventListener('click', registerUser);
}

const managerLoginPageButton = document.getElementById('managerLoginPage');
if (managerLoginPageButton) {
    managerLoginPageButton.addEventListener('click', function () {
        window.location.href = "managerLogin.html";
    });
}

const userLoginPageButton = document.getElementById('userLoginPage');
if (userLoginPageButton) {
    userLoginPageButton.addEventListener('click', function () {
        window.location.href = "userLoginPage.html"
    })
}

const managerLoginButton = document.getElementById('managerLogin');
if (managerLoginButton) {
    managerLoginButton.addEventListener('click', managerLogin);
}

// Initialise variables
var data;
let editingUserId = null;
let registerHandler = null;
let editHandler = null;

function showMessage(elementId, message, isError = false) {
    const messageElement = document.getElementById(elementId);

    if (!messageElement) {
        console.error('Message element not found');
        return;
    }

    messageElement.textContent = message;
    messageElement.style.color = isError ? 'red' : 'green';
}

document.getElementById('registerUserContent').style.display = 'none';

async function managerLogin() {
    const username = document.getElementById('managerUsername').value;

    try {
        const response = await fetch('http://localhost:8082/user/login/begin', {
            method: 'POST',
            credentials: 'include', // Include cookies in the request
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, "isManager": 1 })
        });

        if (!response.ok) {
            const msg = await response.json(); 
            throw new Error('Failed to get login options from server: ' + msg);
        }

        const { options, session_id } = await response.json();

        const assertionResponse = await SimpleWebAuthnBrowser.startAuthentication(options.publicKey);

        const verificationResponse = await fetch(`http://localhost:8082/manager/login/finish?session_id=${session_id}`, {
            method: 'POST',
            credentials: 'include', // Include cookies in the request
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assertionResponse)
        });
        
        var {message, userid } = await verificationResponse.json();
        if (verificationResponse.ok) {
            user_id = userid;
            showMessage('managerLoginMessage', "Login successful: " + message, false);
            isManagerLoggedIn();
            window.location.reload();
        } else {
            showMessage('managerLoginMessage', "Login failed: " + message, true);
        }
    } catch (error) {
        showMessage('managerLoginMessage', 'Error: ' + error.message, true);
    }
}

function openAddUserModal() {
    showMessage('message', '', false)
    showMessage('bindmessage', '', false)
    showMessage('initialPhotoMessage', '', false)

    document.getElementById('modalTitle').textContent = 'Register User';
    document.getElementById('icField').style.display = 'block';
    editingUserId = null;
    resetPhotoState();
    document.getElementById('username').value = '';
    document.getElementById('bindUserIC').value = '';

    document.getElementById('modalFooterButton').textContent = 'Register User';
    const modalFooterButton = document.getElementById('modalFooterButton');

    // If there was a previous event listener for editing, remove it
    modalFooterButton.removeEventListener('click', registerHandler);
    modalFooterButton.removeEventListener('click', editHandler);

    // Define the register handler function only once
    registerHandler = function() {
        registerUser();
    };

    // Add the event listener for registering a user
    modalFooterButton.addEventListener('click', registerHandler);

    const userModal = new bootstrap.Modal(document.getElementById('userModal'));
    userModal.show();
}

function openEditUserModal(userId, username) {
    showMessage('message', '', false)
    showMessage('bindmessage', '', false)
    showMessage('initialPhotoMessage', '', false)

    document.getElementById('modalTitle').textContent = `Edit ${username}`;
    document.getElementById('icField').style.display = 'none';
    editingUserId = userId;
    resetPhotoState();
    document.getElementById('username').value = username;
    
    document.getElementById('modalFooterButton').textContent = 'Save changes';
    const modalFooterButton = document.getElementById('modalFooterButton');

    // If there was a previous event listener for registering, remove it
    modalFooterButton.removeEventListener('click', registerHandler);
    modalFooterButton.removeEventListener('click', editHandler);
    
    // Define the edit handler function only once
    editHandler = function() {
        uploadInitialPhoto(editingUserId);
    };

    // Add the event listener for editing a user
    modalFooterButton.addEventListener('click', editHandler);

    const userModal = new bootstrap.Modal(document.getElementById('userModal'));
    userModal.show();

}

async function registerUser() {
    const username = document.getElementById('username').value;
    const icNum = document.getElementById('bindUserIC').value;
    
    if (data == null) {
        alert('Photo must be taken.');
        return;
    }

    try {
        const bindResponse = await fetch('http://localhost:8082/user/getUserID', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ icNum })
        })

        console.log("bindResponse: ", bindResponse);

        if (!bindResponse.ok) {
            const msg = await bindResponse.json();
            throw new Error(msg);
        } else {
            showMessage("bindmessage", "User IC found and bindable", false)
        }

    } catch (error) {
        showMessage("bindmessage", 'Error: ' + error.message, true)
        return
    }

    try {
        const response = await fetch('http://localhost:8082/user/register/begin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        if (!response.ok) {
            const msg = await response.json();
            throw new Error('User already exists or failed to get registration options from server: ' + msg);
        }

        const { options, session_id } = await response.json();

        console.log("options:", options)
        console.log("Session id", session_id)

        // Start WebAuthn registration with modified options
        const attestationResponse = await SimpleWebAuthnBrowser.startRegistration(options.publicKey);

        console.log("attestation", attestationResponse)

        // Send attestation response to server
        const verificationResponse = await fetch(`http://localhost:8082/user/register/finish?session_id=${session_id}&ic=${icNum}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attestationResponse)
        });

        const msg = await verificationResponse.json();
        if (verificationResponse.ok) {
            editingUserId = msg.userID
            uploadInitialPhoto(editingUserId);
            showMessage("message", "Registration successful: " + msg.message, false);
        } else {
            showMessage("message", "Registration failed: " + msg.message, true);
        }
    } catch (error) {
        showMessage("message" ,'Error: ' + error.message, true);
    }
}

registerUserPage = document.getElementById('registerUserContent');

async function uploadInitialPhoto(editingUserId) {

    const username = document.getElementById('username').value;
    let initialPhoto;
    if (data != null) {
        initialPhoto = data.split(",")[1];
    } else {
        initialPhoto = null;
    }

    if (editingUserId == null) {
        userID = '0';
    } else {
        userID = editingUserId;
    }

    
    const response = await fetch ('http://localhost:8082/user/UploadInitialPhoto', {
        method: 'PUT',
        credentials: 'include', // Include cookies in the request
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID, username, initialPhoto })
    });
    if (!response.ok) {
        const msg = await response.json();
        console.error('Error uploading initial image', error);
        showMessage('initialPhotoMessage', 'Failed uploading image', true)
        return
    }
    if (data != null) {
      showMessage('initialPhotoMessage', 'Successfully uploaded image', false);  
    }
    showMessage('message', 'Successfully changed name', false);
    getCredentialList();
}

async function isManagerLoggedIn() {
    const response = await fetch('http://localhost:8082/manager/GetManagerLoginStatus', {
        method: 'GET',
        credentials: 'include', // Include cookies in the request
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        const msg = await response.json();
        if (registerUserPage) {
            registerUserPage.innerHTML = `
            <div class="container mt-5">    
                <h3 class="text-center">Nice try. You are not logged in as manager.</h3>
            </div>
            `;
        }
        throw new Error('Failed to get login status: ' + msg);
    }

    document.getElementById('managerLoginContent').style.display = 'none';
    document.getElementById('registerUserContent').style.display = 'block';
}

let allCredentials = [];

async function getCredentialList() {
    selectedUser = null;

    // Show loading spinner
    const userCredContainer = document.createElement('div');
    userCredContainer.id = "userCredContainer";
    userCredContainer.className = "container mt-3";
    userCredContainer.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>';
    
    const existingContainer = document.getElementById('userCredContainer');
    if(existingContainer) {
        existingContainer.remove();
    } selectedSlot = null;

    credentialList = document.getElementById('credentialList');
    if (credentialList) {
        credentialList.appendChild(userCredContainer);
    }

    await fetch(`http://localhost:8082/user/GetCredentialList`)
    .then(async response => {
        if (!response.ok) {
            // const msg = await response.json();
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        userCredContainer.innerHTML = '';

        if (!data.credential || data.credential.length === 0) {
            slotContainer.innerHTML = '<p> No credentials available</p>'
            return;
        }

        allCredentials = data.credential;

        displayCredentials(allCredentials);

    })
    .catch(error => {
        console.error("Error fetching credentials: ", error);
        userCredContainer.innerHTML = '<p class="text-danger">Failed to retrieve credentials. Please try again later.</p>';
    })
}

function displayCredentials(credentials) {
    const userCredContainer = document.querySelector('.user-cred-container');
    userCredContainer.innerHTML = '';

    credentials.forEach(cred => {
        const date = new Date(cred.createdAt.replace(" ", "T"));
        const options = {year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', seconds: '2-digit', hour12: true}

        const cardDiv = document.createElement('div');
        cardDiv.className = 'col-md-6 card mb-3';

        cardDiv.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${cred.name}</h5>
                <p class="card-text">
                    Username: ${cred.username} <br>
                    User ID: ${cred.userID} <br>
                    Credential ID: ${cred.credentialID} <br>
                    Created At: ${date.toLocaleString('en-UK', options)} <br>
                </p>
                <button class="btn btn-danger delete-credential" data-credentialid="${cred.credentialID}">Delete</button>
                <button class="btn btn-primary edit-credential" data-userid="${cred.userID}" data-credentialname="${cred.username}">Edit</button>
            </div>
        `;
        userCredContainer.append(cardDiv);
    });

    document.querySelectorAll('.delete-credential').forEach(button => {
        let confirmState = false;

        button.addEventListener('click', function() {
            const credentialID = this.getAttribute('data-credentialid');

            document.querySelectorAll('.delete-credential').forEach(btn => {
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-danger');
                btn.textContent = "Delete";
                // confirmState = false;
            })

            if (!confirmState) {
                this.textContent = "Confirm delete?";
                this.classList.remove('btn-danger');
                this.classList.add('btn-warning');
                confirmState = true;
            } else {
                deleteCredential(credentialID, this);
                confirmState = false;
            }

            console.log('Delete credential ID: ', credentialID);
        });
    });

    document.querySelectorAll('.edit-credential').forEach(button => {
        button.addEventListener('click', function() {
            const userID = this.getAttribute('data-userID');
            const credentialName = this.getAttribute('data-credentialname');

            openEditUserModal(userID, credentialName);
        });
    });
}

// Search filter for credential list
searchInputField = document.getElementById('searchInput');
if (searchInputField) {
    searchInputField.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();

        const filteredCredentials = allCredentials.filter(cred => {
            return cred.name.toLowerCase().includes(searchTerm) ||
                   cred.username.toLowerCase().includes(searchTerm)
        });
    displayCredentials(filteredCredentials);

    // Show full list when the search is cleared
    if (searchTerm === '') {
        displayCredentials(allCredentials);
    }
    });
}

async function deleteCredential(credentialID, button) {
    try {
        const response = await fetch(`http://localhost:8082/user/DeleteCredential/${credentialID}`, {
            method: 'DELETE', 
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete credential');
        }

        button.closest('.card').remove();
        console.log(`Credential ${credentialID} deleted successfully`);
    } catch (error) {
        console.error("Error deleting credential: ", error);
        button.textContent = "Delete";
        button.classList.remove('btn-warning');
        button.classList.add('btn-danger');
    }
}

getCredentialList();
isManagerLoggedIn();

// ----------------------- Camera section ----------------------- //
video = document.querySelector("#registerVideoElement");
photo = document.getElementById('initialPhoto');
takePhotoButton = document.getElementById('takeInitialPhotoButton');
canvas = document.getElementById('registerCanvas');
output = document.getElementById('registerOutput');

if (output) {
    output.style.display = 'none';
}

if (takePhotoButton) {
    takePhotoButton.addEventListener('click', takeInitialPicture);
}

navigator.permissions.query({ name: 'camera' })
    .then((permissionObj) => {
        console.log(permissionObj.state);
        if (permissionObj.state === "granted") {
            console.log("can register i guess?");
        }
    })
    .catch((error) => {
        console.log('Got error: ', error);
    })
if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (stream) {
            video.srcObject = stream;
        })
        .catch(function (error) {
            console.log("Something went wrong: camera object not found");
        });
}

function takeInitialPicture() {
    document.getElementById('registerVideoContainer').style.display = 'none';
    output.style.display = 'flex';

    canvas.style.display = 'none';

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    data = canvas.toDataURL("image/jpeg", 1);
    photo.setAttribute("src", data);

    console.log(data);

    allowRetakeInitialPhoto();
}

function allowRetakeInitialPhoto() {
    takePhotoButton.textContent = "Retake photo";
    takePhotoButton.removeEventListener("click", takeInitialPicture);

    takePhotoButton.addEventListener('click', resetPhotoState)
}

function resetPhotoState() {
    data = null;
    photo.removeAttribute('src');
    takePhotoButton.textContent = "Take photo";
    document.getElementById('registerVideoContainer').style.display= 'flex';
    output.style.display = 'none';
    takePhotoButton.addEventListener('click', takeInitialPicture);
}