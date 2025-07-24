        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);

        const starCount = 2000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 200; 
            positions[i * 3 + 1] = (Math.random() - 0.5) * 200; 
            positions[i * 3 + 2] = (Math.random() - 0.5) * 200; 
            colors[i * 3] = 1; 
            colors[i * 3 + 1] = 1; 
            colors[i * 3 + 2] = Math.random() * 0.5 + 0.5; 
            sizes[i] = Math.random() * 0.5 + 0.1; 
        }

        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const starShaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                pointTexture: { value: new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png') }
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                void main() {
                    vec2 uv = gl_PointCoord;
                    float glow = sin(time * 2.0 + gl_FragCoord.x * 0.01) * 0.3 + 0.7;
                    vec4 texColor = texture2D(pointTexture, uv);
                    gl_FragColor = vec4(vColor * glow, texColor.a * glow);
                }
            `,
            transparent: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        });

        const stars = new THREE.Points(starGeometry, starShaderMaterial);
        scene.add(stars);

        camera.position.z = 50;

        function animate() {
            requestAnimationFrame(animate);
            stars.rotation.y += 0.0005;
            stars.rotation.x += 0.0003;
            starShaderMaterial.uniforms.time.value += 0.01; 
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        });

        let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        let taskToDelete = null;

        function addTask() {
            const taskText = document.getElementById('taskInput').value.trim();
            const category = document.getElementById('categoryInput').value;
            const priority = document.getElementById('priorityInput').value;
            const dueDate = document.getElementById('dueDateInput').value;
            const progress = document.getElementById('progressInput').value;
            const notes = document.getElementById('notesInput').value.trim();

            if (!taskText) return;

            const task = {
                id: Date.now(),
                text: taskText,
                category,
                priority,
                dueDate,
                progress,
                notes,
                completed: progress === '100'
            };

            tasks.push(task);
            saveTasks();
            renderTasks();

            gsap.from('.task-item:last-child', { y: 50, opacity: 0, duration: 0.5 });

            document.getElementById('taskInput').value = '';
            document.getElementById('dueDateInput').value = '';
            document.getElementById('progressInput').value = '0';
            document.getElementById('notesInput').value = '';
        }

        function renderTasks() {
            const taskList = document.getElementById('taskList');
            const search = document.getElementById('searchInput').value.toLowerCase();
            const filterCategory = document.getElementById('filterCategory').value;
            const filterPriority = document.getElementById('filterPriority').value;
            const filterProgress = document.getElementById('filterProgress').value;

            taskList.innerHTML = '';

            tasks
                .filter(task => 
                    (task.text.toLowerCase().includes(search) || task.notes.toLowerCase().includes(search)) &&
                    (filterCategory === 'All' || task.category === filterCategory) &&
                    (filterPriority === 'All' || task.priority === filterPriority) &&
                    (filterProgress === 'All' || task.progress === filterProgress)
                )
                .forEach(task => {
                    const li = document.createElement('li');
                    li.className = `task-item ${task.completed ? 'completed' : ''}`;
                    li.draggable = true;
                    li.innerHTML = `
                        <input type="checkbox" ${task.completed ? 'checked' : ''} onclick="toggleTask(${task.id})">
                        <span class="task-text">${task.text}</span>
                        <span class="category">${task.category}</span>
                        <span class="priority priority-${task.priority.toLowerCase()}">${task.priority}</span>
                        <span class="due-date">${task.dueDate || 'No due date'}</span>
                        <span class="progress">${task.progress === '0' ? 'Not Started' : task.progress === '50' ? 'In Progress' : 'Completed'}</span>
                        <span class="notes" title="${task.notes}">${task.notes || 'No notes'}</span>
                        <button class="delete-btn" onclick="openDeleteModal(${task.id})">Delete</button>
                    `;
                    taskList.appendChild(li);
                });

            const taskItems = document.querySelectorAll('.task-item');
            taskItems.forEach(item => {
                item.addEventListener('dragstart', () => {
                    item.classList.add('dragging');
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    updateTaskOrder();
                });
            });

            taskList.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = getDragAfterElement(taskList, e.clientY);
                const dragging = document.querySelector('.dragging');
                if (afterElement == null) {
                    taskList.appendChild(dragging);
                } else {
                    taskList.insertBefore(dragging, afterElement);
                }
            });
        }

        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        function updateTaskOrder() {
            const taskItems = document.querySelectorAll('.task-item');
            const newTasks = [];
            taskItems.forEach(item => {
                const id = parseInt(item.querySelector('button').getAttribute('onclick').match(/\d+/)[0]);
                const task = tasks.find(t => t.id === id);
                newTasks.push(task);
            });
            tasks = newTasks;
            saveTasks();
        }

        function toggleTask(id) {
            tasks = tasks.map(task => 
                task.id === id ? { ...task, completed: !task.completed, progress: task.completed ? '0' : '100' } : task
            );
            saveTasks();
            renderTasks();
        }

        function openDeleteModal(id) {
            taskToDelete = id;
            document.getElementById('deleteModal').style.display = 'flex';
            gsap.from('.modal-content', { scale: 0.8, opacity: 0, duration: 0.3 });
        }

        function closeModal() {
            document.getElementById('deleteModal').style.display = 'none';
            taskToDelete = null;
        }

        function confirmDelete() {
            tasks = tasks.filter(task => task.id !== taskToDelete);
            saveTasks();
            renderTasks();
            closeModal();
        }

        function saveTasks() {
            localStorage.setItem('tasks', JSON.stringify(tasks));
        }

        function toggleTheme() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        }

        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }

        document.getElementById('searchInput').addEventListener('input', renderTasks);
        document.getElementById('filterCategory').addEventListener('change', renderTasks);
        document.getElementById('filterPriority').addEventListener('change', renderTasks);
        document.getElementById('filterProgress').addEventListener('change', renderTasks);

        renderTasks();
