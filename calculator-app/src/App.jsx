import { useState } from 'react'
import './App.css'

function App() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  const handleNumClick = (num) => {
    if (waitingForNewValue) {
      setDisplay(String(num));
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? String(num) : display + num);
    }
  };

  const handleOperatorClick = (op) => {
    if (operator && !waitingForNewValue) {
      const result = calculate(previousValue, display, operator);
      setDisplay(String(result));
      setPreviousValue(String(result));
    } else {
      setPreviousValue(display);
    }
    setOperator(op);
    setWaitingForNewValue(true);
  };

  const calculate = (a, b, op) => {
    const num1 = parseFloat(a);
    const num2 = parseFloat(b);
    if (isNaN(num1) || isNaN(num2)) return b;

    switch (op) {
      case '+': return num1 + num2;
      case '-': return num1 - num2;
      case '*': return num1 * num2;
      case '/': return num2 === 0 ? 'Error' : num1 / num2;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (!operator || !previousValue) return;
    const result = calculate(previousValue, display, operator);
    setDisplay(String(result));
    setPreviousValue(null);
    setOperator(null);
    setWaitingForNewValue(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
  };

  const handleDecimal = () => {
    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  return (
    <div className="calculator">
      <div className="display">{display}</div>
      <div className="buttons">
        <button className="clear" onClick={handleClear}>AC</button>
        <button onClick={() => setDisplay(String(parseFloat(display) * -1))}>+/-</button>
        <button className="operator" onClick={() => handleOperatorClick('/')}>/</button>
        
        <button onClick={() => handleNumClick(7)}>7</button>
        <button onClick={() => handleNumClick(8)}>8</button>
        <button onClick={() => handleNumClick(9)}>9</button>
        <button className="operator" onClick={() => handleOperatorClick('*')}>*</button>
        
        <button onClick={() => handleNumClick(4)}>4</button>
        <button onClick={() => handleNumClick(5)}>5</button>
        <button onClick={() => handleNumClick(6)}>6</button>
        <button className="operator" onClick={() => handleOperatorClick('-')}>-</button>
        
        <button onClick={() => handleNumClick(1)}>1</button>
        <button onClick={() => handleNumClick(2)}>2</button>
        <button onClick={() => handleNumClick(3)}>3</button>
        <button className="operator" onClick={() => handleOperatorClick('+')}>+</button>
        
        <button className="zero" onClick={() => handleNumClick(0)}>0</button>
        <button onClick={handleDecimal}>.</button>
        <button className="equals" onClick={handleEquals}>=</button>
      </div>
    </div>
  )
}

export default App
