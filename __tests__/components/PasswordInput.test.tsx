import { render, screen, fireEvent } from '@testing-library/react';
import PasswordInput from '@/components/PasswordInput';

describe('PasswordInput Component', () => {
  it('should render password input', () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText('Enter your password');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('should toggle password visibility', () => {
    render(<PasswordInput value="test123" onChange={() => {}} />);
    const toggleButton = screen.getByRole('button');
    const input = screen.getByPlaceholderText('Enter your password') as HTMLInputElement;
    
    // Initially should be password type
    expect(input.type).toBe('password');
    
    // Click to show password
    fireEvent.click(toggleButton);
    expect(input.type).toBe('text');
    
    // Click to hide password
    fireEvent.click(toggleButton);
    expect(input.type).toBe('password');
  });

  it('should call onChange when input changes', () => {
    const handleChange = jest.fn();
    render(<PasswordInput value="" onChange={handleChange} />);
    const input = screen.getByPlaceholderText('Enter your password');
    
    fireEvent.change(input, { target: { value: 'newpassword' } });
    expect(handleChange).toHaveBeenCalled();
  });
});

