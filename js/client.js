// client.js - Dashboard UI interactions

document.addEventListener('DOMContentLoaded', () => {
    // Simple tab switching for purposes
    const navLinks = document.querySelectorAll('.sidebar ul li a');
    
    navLinks.forEach(link => {
        if(link.id) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove active class
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // In a real app, this would load component views or fetch data
                // Here we just simulate an action for the UI demonstration
                alert(`Navigating to ${link.innerText}`);
            });
        }
    });
});
