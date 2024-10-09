document.getElementById('registerButton').addEventListener('click', register);
document.getElementById('loginButton').addEventListener('click', login);

function showMessage(message, isError = false) {
    const messageElement = document.getElementById('message');
    
    if (!messageElement) {
        console.error('Message element not found');
        return;
    }

    messageElement.textContent = message;
    messageElement.style.color = isError ? 'red' : 'green';
}

async function register() {
    const username = document.getElementById('username').value;

    try {
        const response = await fetch('http://localhost:8082/users/register/begin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username})
        });

        if (!response.ok) {
            const msg = await response.json();
            throw new Error('User already exists or failed to get registration options from server: ' + msg);
        }

        const { options, session_id } = await response.json();

        console.log(options)
        console.log(session_id)

        // Start WebAuthn registration with modified options
        const attestationResponse = await SimpleWebAuthnBrowser.startRegistration(options.publicKey);

        // Send attestation response to server
        const verificationResponse = await fetch(`http://localhost:8082/users/register/finish?session_id=${session_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attestationResponse)
        });

        const msg = await verificationResponse.json();
        if (verificationResponse.ok) {
            showMessage("Registration successful: " + msg, false);
        } else {
            showMessage("Registration failed: " + msg, true);
        }
    } catch (error) {
        showMessage('Error: ' + error.message, true);
    }
}

async function login() {
    const username = document.getElementById('username').value;

    try {
        const response = await fetch('http://localhost:8082/users/login/begin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({username})
        });

        if (!response.ok) {
            const msg = await response.json();
            throw new Error('Failed to get login options from server: ' + msg);
        }

        const { options, session_id } = await response.json();

        const assertionResponse = await SimpleWebAuthnBrowser.startAuthentication(options.publicKey);

        const verificationResponse = await fetch(`http://localhost:8082/users/login/finish?session_id=${session_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assertionResponse)
        });

        const msg = await verificationResponse.json();
        if (verificationResponse.ok) {
            showMessage("Login successful: " + msg, false);
        } else {
            showMessage("Login failed: " + msg, true);
        }
    } catch (error) {
        showMessage('Error: ' + error.message, true);
    }
}

// function base64UrlToUint8Array(base64Url) {

//     if (typeof base64Url !== 'string') {
//         console.error('Expected base64Url to be a string but got:', base64Url);
//         return new Uint8Array();
//     }
    
//     const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
//     const binaryString = atob(base64);
//     const len = binaryString.length;
//     const bytes = new Uint8Array(len);
//     for (let i = 0; i < len; i++) {
//         bytes[i] = binaryString.charCodeAt(i);
//     }
//     return bytes;
// }