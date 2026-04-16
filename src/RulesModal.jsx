import React from 'react';
 
export default function RulesModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box rules-box" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>Правила Set (Сет)</h2>

        <h3>Цель</h3>
        <p>Найти набор из 3 карт, где каждая из 4 характеристик либо <strong>у всех одинакова</strong>, либо <strong>у всех разная</strong>.</p>

        <h3>Характеристики</h3>
        <ul>
          <li><strong>Цвет:</strong> зелёный, красный, фиолетовый</li>
          <li><strong>Форма:</strong> прямоугольник, овал, волна</li>
          <li><strong>Количество:</strong> 1, 2 или 3</li>
          <li><strong>Заполнение:</strong> пустое, полное, крапинка</li>
        </ul>

        <div className="magic-rule">
          Два признака совпали, а третий — нет,<br />
          значит это — вовсе не «Сет»!
        </div>

        <h3>Как играть</h3>
        <ol>
          <li>Кликай на карты (до 3 штук)</li>
          <li>После 3-й карты идёт автоматическая проверка</li>
          <li>Правильно → очко, карты заменяются</li>
          <li>Ошибка → блокировка на 2 сек, очко ошибок</li>
          <li>Нет сета → нажми «+ 3 карты»</li>
        </ol>

        <h3>Мультиплеер</h3>
        <p>Оба игрока видят одно поле. Кто первым правильно выберет сет — тот забирает очко. При одновременном выборе побеждает тот, чей ответ пришёл раньше.</p>
      </div>
    </div>
  );
}
