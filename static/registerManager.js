const registerManagerButton = document.getElementById('registerManagerButton')
if (registerManagerButton) {
    registerManagerButton.addEventListener('click', registerManager)
}

function showMessage(elementId, message, isError = false) {
    const messageElement = document.getElementById(elementId);

    if (!messageElement) {
        console.error('Message element not found');
        return;
    }

    messageElement.textContent = message;
    messageElement.style.color = isError ? 'red' : 'green';
}

async function registerManager() {
    const username = document.getElementById('managerUsername').value
    const icNum = document.getElementById('bindManagerIC').value 
    const passPhrase = document.getElementById('passPhrase').value

    try {
        const bindResponse = await fetch ('http://localhost:8082/user/getUserID', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({icNum, passPhrase, "isManager": 1})
        })

        if (!bindResponse.ok) {
            const msg = await bindResponse.json();
            throw new Error(msg);
        } else {
            showMessage('bindmessage', 'Manager IC found and bindable', false)
            showMessage('passphrasemessage', 'Passphrase is correct', false)
        }
    } catch (error) {
        showMessage('message', 'Error: ' + error.message, true)
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
            showMessage("message", "Registration successful: " + msg, false);
        } else {
            showMessage("message", "Registration failed: " + msg, true);
        }
    } catch (error) {
        showMessage("message" ,'Error: ' + error.message, true);
    }
}
